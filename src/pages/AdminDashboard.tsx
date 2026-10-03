import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppShell } from "@/components/AppShell";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notifyTelegramReview, notifyTelegramCorrections } from "@/lib/notifyTelegram";
import { Search, Archive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { logAction } from "@/lib/actionLog";
import { TASK_LIST_FIELDS, archiveCutoffIso, isArchived, type BoardTask } from "@/lib/taskFields";
import { createRefreshGuard, POLL_HEALTHY_MS, POLL_DEGRADED_MS } from "@/lib/refreshGuard";
import { useProfiles, buildUserMap } from "@/hooks/useProfiles";

type TaskStatus = Database["public"]["Enums"]["task_status"];

import { type Board } from "@/lib/boards";
import { useBoards } from "@/hooks/useBoards";

const sel = (s: string): string => s;

export default function AdminDashboard({ board = "motion" }: { board?: Board }) {
  const { user, role } = useAuth();
  const isTeamlead = role === "teamlead";
  const { t } = useLanguage();
  const { label: boardLabel } = useBoards();
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<BoardTask[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [memberIds, setMemberIds] = useState<string[] | null>(null);
  const [membersReady, setMembersReady] = useState(false);
  const lastPollRef = useRef(0);

  const cutoffIso = useMemo(() => archiveCutoffIso(14), []);
  const cutoffMs = useMemo(() => new Date(cutoffIso).getTime(), [cutoffIso]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setCreateDialogOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Resolve which users this dashboard is allowed to show (teamlead scope).
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!isTeamlead || !user) {
        if (!cancelled) { setMemberIds(null); setMembersReady(true); }
        return;
      }
      const { data: members } = await supabase
        .from("team_memberships")
        .select("member_id")
        .eq("teamlead_id", user.id);
      if (cancelled) return;
      const ids = Array.from(new Set([...(members || []).map((m: any) => m.member_id), user.id]));
      setMemberIds(ids);
      setMembersReady(true);
    };
    setMembersReady(false);
    resolve();
    return () => { cancelled = true; };
  }, [user?.id, isTeamlead]);

  const { data: users = [] } = useProfiles(memberIds, membersReady);
  const userMap = useMemo(() => buildUserMap(users), [users]);

  // Active tasks only: everything not done, plus recently finished ones.
  const fetchTasks = useCallback(async () => {
    if (!membersReady) return;
    let q = supabase
      .from("tasks")
      .select(sel(TASK_LIST_FIELDS))
      .or(`status.neq.done,completed_at.gte.${cutoffIso},created_at.gte.${cutoffIso}`)
      .order("created_at", { ascending: true });
    if (memberIds) q = q.in("user_id", memberIds);
    const { data } = await q.returns<BoardTask[]>();
    if (data) setTasks(data);
  }, [membersReady, memberIds, cutoffIso]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Realtime: patch local state instead of refetching everything.
  useEffect(() => {
    if (!membersReady) return;
    const guarded = createRefreshGuard(fetchTasks, 10_000, true);
    let healthy = false;
    const allowed = (row: any) => !memberIds || memberIds.includes(row?.user_id);
    const channel = supabase
      .channel("admin-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        const next = payload.new as BoardTask | undefined;
        const old = payload.old as { id?: string } | undefined;
        if (payload.eventType === "DELETE") {
          if (old?.id) setTasks((prev) => prev.filter((t) => t.id !== old.id));
          return;
        }
        if (!next?.id || !allowed(next)) {
          if (next?.id) setTasks((prev) => prev.filter((t) => t.id !== next.id));
          return;
        }
        setTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === next.id);
          if (idx === -1) return [...prev, next];
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...next };
          return copy;
        });
      })
      .subscribe((status) => {
        // Reconnect / resync whenever the socket drops (token refresh, sleep, network).
        healthy = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") guarded();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setTimeout(() => { guarded(); }, 1000);
        }
      });
    const onFocus = () => { if (document.visibilityState === "visible") guarded(); };
    // Safety net: if realtime is silently dead, the board still refreshes.
    const poll = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (healthy && Date.now() - lastPollRef.current < POLL_HEALTHY_MS) return;
      lastPollRef.current = Date.now();
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
  }, [membersReady, memberIds, fetchTasks]);



  // Archive is loaded only when the user opens it.
  useEffect(() => {
    if (!showArchive || !membersReady) return;
    let cancelled = false;
    setArchiveLoading(true);
    const load = async () => {
      let q = supabase
        .from("tasks")
        .select(sel(TASK_LIST_FIELDS))
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(500);
      if (memberIds) q = q.in("user_id", memberIds);
      const { data } = await q.returns<BoardTask[]>();
      if (cancelled) return;
      if (data) setArchivedTasks(data.filter((t) => isArchived(t, cutoffMs)));
      setArchiveLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [showArchive, membersReady, memberIds, cutoffMs]);

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    const updates: Database["public"]["Tables"]["tasks"]["Update"] = { status };
    const task = tasks.find((t) => t.id === taskId);
    if (status === "in_progress") {
      if (!task?.in_progress_at) updates.in_progress_at = new Date().toISOString();
    }
    if (status === "review" || status === "done") {
      if (!task?.completed_at) updates.completed_at = new Date().toISOString();
      // If task is currently paused, close the pause window so paused time is correct
      if ((task as any)?.paused_at) {
        const addMs = Date.now() - new Date((task as any).paused_at).getTime();
        updates.paused_total_ms = Number((task as any).paused_total_ms || 0) + Math.max(0, addMs);
        updates.paused_at = null;
      }
    }
    if (status !== "review" && status !== "done") updates.completed_at = null;
    // Optimistic local update; realtime confirms it right after.
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...(updates as any) } : t)));
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
        userName: userMap[task.user_id] || "Unknown",
        appUrl: window.location.origin,
      }).catch(console.error);
    }

    if (status === "corrections" && task && task.status !== "corrections") {
      notifyTelegramCorrections({
        taskId: task.id,
        taskCode: task.task_code || task.id.slice(0, 8),
        taskTitle: task.title,
        designerName: userMap[task.user_id] || null,
        actorName: (user ? userMap[user.id] : null) || user?.email || null,
        appUrl: window.location.origin,
      });
    }
  };

  const matchesFilters = useCallback((t: BoardTask) => {
    if (((t as any).board || "motion") !== board) return false;
    if (userFilter !== "all" && t.user_id !== userFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!t.title.toLowerCase().includes(s) && !(t.task_code && t.task_code.toLowerCase().includes(s))) return false;
    }
    return true;
  }, [board, userFilter, search]);

  const activeTasks = useMemo(
    () => tasks.filter((t) => matchesFilters(t) && !isArchived(t, cutoffMs)),
    [tasks, matchesFilters, cutoffMs]
  );

  const visibleArchived = useMemo(
    () => archivedTasks.filter(matchesFilters),
    [archivedTasks, matchesFilters]
  );

  const boardTasks = useMemo(
    () => tasks.filter((tk) => ((tk as any).board || "motion") === board),
    [tasks, board]
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
              {isTeamlead ? t("user.myTasks") : t("admin.tasks")} · {boardLabel(board)}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {boardTasks.filter(t => t.status !== "done").length} {t("admin.totalAcross")} {users.length} {isTeamlead ? t("users.teamMembers").toLowerCase() : t("admin.users")}
            </p>
          </div>
          <CreateTaskDialog users={users as any} onCreated={fetchTasks} externalOpen={createDialogOpen} onExternalOpenChange={setCreateDialogOpen} defaultBoard={board} />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.searchTasks")} className="pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="flex-1 sm:w-[180px]"><SelectValue placeholder={t("admin.allUsers")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.allUsers")}</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email || u.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showArchive ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchive(!showArchive)}
              className="gap-1.5 shrink-0"
            >
              {showArchive && archiveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              <span className="hidden sm:inline">{t("admin.archive")}</span>
              {showArchive && !archiveLoading && visibleArchived.length > 0 && (
                <span className="text-xs font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{visibleArchived.length}</span>
              )}
            </Button>
          </div>
        </div>

        {showArchive ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              {t("admin.archiveDesc")} {archiveLoading ? "" : `(${visibleArchived.length})`}
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
            ) : visibleArchived.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {t("admin.noArchived")}
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {visibleArchived.map((task) => (
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
                        {userMap[task.user_id] && (
                          <span className="text-xs text-muted-foreground">{userMap[task.user_id]}</span>
                        )}
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
          <KanbanBoard tasks={activeTasks as any} onStatusChange={handleStatusChange} userMap={userMap} showAssignee onTaskDeleted={fetchTasks} users={users as any} isAdmin />
        )}
      </div>
    </AppShell>
  );
}
