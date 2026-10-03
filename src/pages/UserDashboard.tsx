import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppShell } from "@/components/AppShell";
import { KanbanBoard } from "@/components/KanbanBoard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notifyTelegramReview, notifyTelegramCorrections } from "@/lib/notifyTelegram";
import { Search, Archive, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { logAction } from "@/lib/actionLog";
import { TASK_LIST_FIELDS, archiveCutoffIso, isArchived, type BoardTask } from "@/lib/taskFields";
import { createRefreshGuard, POLL_HEALTHY_MS, POLL_DEGRADED_MS } from "@/lib/refreshGuard";

type TaskStatus = Database["public"]["Enums"]["task_status"];

import { type Board } from "@/lib/boards";
import { useBoards } from "@/hooks/useBoards";

const sel = (s: string): string => s;

export default function UserDashboard({ board = "motion" }: { board?: Board }) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { label: boardLabel } = useBoards();
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [archivedRows, setArchivedRows] = useState<BoardTask[]>([]);
  const [search, setSearch] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const cutoffIso = useMemo(() => archiveCutoffIso(14), []);
  const cutoffMs = useMemo(() => new Date(cutoffIso).getTime(), [cutoffIso]);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select(sel(TASK_LIST_FIELDS))
      .eq("user_id", user.id)
      .or(`status.neq.done,completed_at.gte.${cutoffIso},created_at.gte.${cutoffIso}`)
      .order("created_at", { ascending: true })
      .returns<BoardTask[]>();
    if (data) setTasks(data);
  }, [user?.id, cutoffIso]);

  useEffect(() => {
    if (!user?.id) return;
    fetchTasks();
    const guarded = createRefreshGuard(fetchTasks, 10_000, true);
    let healthy = false;
    let lastPoll = 0;
    const channel = supabase
      .channel(`user-tasks-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` }, (payload) => {
        const next = payload.new as BoardTask | undefined;
        const old = payload.old as { id?: string } | undefined;
        if (payload.eventType === "DELETE") {
          if (old?.id) setTasks((prev) => prev.filter((t) => t.id !== old.id));
          return;
        }
        if (!next?.id) return;
        setTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === next.id);
          if (idx === -1) return [...prev, next];
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...next };
          return copy;
        });
      })
      .subscribe((status) => {
        healthy = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") guarded();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setTimeout(() => { guarded(); }, 1000);
        }
      });
    const onFocus = () => { if (document.visibilityState === "visible") guarded(); };
    const poll = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (healthy && Date.now() - lastPoll < POLL_HEALTHY_MS) return;
      lastPoll = Date.now();
      guarded();
    }, POLL_DEGRADED_MS);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(poll);
    };
  }, [user?.id, fetchTasks]);



  // Archive is loaded only when opened.
  useEffect(() => {
    if (!showArchive || !user?.id) return;
    let cancelled = false;
    setArchiveLoading(true);
    const load = async () => {
      const { data } = await supabase
        .from("tasks")
        .select(sel(TASK_LIST_FIELDS))
        .eq("user_id", user.id)
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(500)
        .returns<BoardTask[]>();
      if (cancelled) return;
      if (data) setArchivedRows(data.filter((tk) => isArchived(tk, cutoffMs)));
      setArchiveLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [showArchive, user?.id, cutoffMs]);

  const boardTasks = useMemo(
    () => tasks.filter((tk) => ((tk as any).board || "motion") === board),
    [tasks, board]
  );


  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    const updates: Database["public"]["Tables"]["tasks"]["Update"] = { status };
    const task = tasks.find((t) => t.id === taskId);
    if (status === "in_progress") {
      if (!task?.in_progress_at) updates.in_progress_at = new Date().toISOString();
    }
    if (status === "review" || status === "done") {
      if (!task?.completed_at) updates.completed_at = new Date().toISOString();
      if ((task as any)?.paused_at) {
        const addMs = Date.now() - new Date((task as any).paused_at).getTime();
        updates.paused_total_ms = Number((task as any).paused_total_ms || 0) + Math.max(0, addMs);
        updates.paused_at = null;
      }
    }
    if (status !== "review" && status !== "done") updates.completed_at = null;
    setTasks((prev) => prev.map((tk) => (tk.id === taskId ? { ...tk, ...(updates as any) } : tk)));
    const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
    if (error) { fetchTasks(); return; }
    if (task) {
      await logAction({
        action: "status_changed",
        entityType: "task",
        entityId: taskId,
        taskId,
        targetUserId: task.user_id,
        details: {
          from: task.status,
          to: status,
        },
      });
    }

    if (status === "review" && task && task.status !== "review") {
      notifyTelegramReview({
        taskId: task.id,
        taskCode: task.task_code || task.id.slice(0, 8),
        taskTitle: task.title,
        userName: profile?.name || user?.email || "Unknown",
        appUrl: window.location.origin,
      }).catch(console.error);
    }

    if (status === "corrections" && task && task.status !== "corrections") {
      notifyTelegramCorrections({
        taskId: task.id,
        taskCode: task.task_code || task.id.slice(0, 8),
        taskTitle: task.title,
        designerName: profile?.name || user?.email || null,
        actorName: profile?.name || user?.email || null,
        appUrl: window.location.origin,
      });
    }
  };

  const matchesSearch = useCallback((tk: BoardTask) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return tk.title.toLowerCase().includes(s) || !!(tk.task_code && tk.task_code.toLowerCase().includes(s));
  }, [search]);

  const activeTasks = useMemo(
    () => boardTasks.filter((tk) => matchesSearch(tk) && !isArchived(tk, cutoffMs)),
    [boardTasks, matchesSearch, cutoffMs]
  );

  const archivedTasks = useMemo(
    () => archivedRows.filter((tk) => ((tk as any).board || "motion") === board && matchesSearch(tk)),
    [archivedRows, board, matchesSearch]
  );


  const statusLabels: Record<string, string> = {
    todo: t("kanban.todo"),
    in_progress: t("kanban.inProgress"),
    review: t("kanban.review"),
    corrections: t("kanban.corrections"),
    done: t("kanban.done"),
  };

  return (
    <AppShell>
      <div className="p-3 sm:p-6">
        <div className="flex items-start sm:items-center justify-between gap-2 mb-4 sm:mb-6">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight truncate">
              {t("user.myTasks")} · {boardLabel(board)}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {boardTasks.filter(t => t.status !== "done").length} {t("user.tasksAssigned")}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.searchTasks")} className="pl-9" />
          </div>
          <Button
            variant={showArchive ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchive(!showArchive)}
            className="gap-1.5 shrink-0"
          >
            {showArchive && archiveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            <span className="hidden sm:inline">{t("admin.archive")}</span>
            {!archiveLoading && archivedTasks.length > 0 && (
              <span className="text-xs font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{archivedTasks.length}</span>
            )}
          </Button>
        </div>

        {showArchive ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              {t("admin.archiveDesc")} {archiveLoading ? "" : `(${archivedTasks.length})`}
            </p>
            {archiveLoading ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("admin.archiveLoading")}
                </div>
                <div className="border rounded-lg divide-y">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 animate-pulse">
                      <div className="h-3 w-1/3 bg-muted rounded" />
                      <div className="h-3 w-1/5 bg-muted rounded mt-2" />
                    </div>
                  ))}
                </div>
              </div>
            ) : archivedTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {t("admin.noArchived")}
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {archivedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => {
                      const code = task.task_code;
                      if (code) {
                        window.location.href = `/task/${code.replace("#", "")}`;
                      }
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {task.task_code && <span className="text-xs font-mono text-primary font-semibold">{task.task_code}</span>}
                        <span className="text-sm font-medium truncate">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{format(new Date(task.created_at), "dd.MM.yy")}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {statusLabels[task.status] || task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <KanbanBoard tasks={activeTasks as any} onStatusChange={handleStatusChange} onTaskDeleted={fetchTasks} />
        )}
      </div>
    </AppShell>
  );
}
