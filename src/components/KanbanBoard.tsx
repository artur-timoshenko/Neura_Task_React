import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowUp, Plus, ArrowUpCircle, ArrowDownCircle, AlertCircle, Flame, Folder, Timer, Clock, GripVertical } from "lucide-react";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { workingElapsedMs } from "@/lib/workingTime";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskStatus = Database["public"]["Enums"]["task_status"];

const priorityIcons = {
  low: { icon: ArrowDownCircle, className: "text-muted-foreground" },
  medium: { icon: AlertCircle, className: "text-status-in-progress" },
  high: { icon: ArrowUpCircle, className: "text-status-review" },
  urgent: { icon: Flame, className: "text-destructive" },
};

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface KanbanBoardProps {
  tasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  userMap?: Record<string, string>;
  showAssignee?: boolean;
  onCreateTask?: (status: TaskStatus) => void;
  onTaskDeleted?: () => void;
  users?: Profile[];
  isAdmin?: boolean;
}

export function KanbanBoard({ tasks, onStatusChange, userMap = {}, showAssignee, onCreateTask, onTaskDeleted, users, isAdmin = false }: KanbanBoardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string | null>>({});
  const boardPathRef = useRef<string>(typeof window !== "undefined" ? window.location.pathname : "/");
  const closeUrl = () => {
    if (window.location.pathname.startsWith("/task/")) {
      window.history.pushState({}, "", boardPathRef.current);
    }
  };
  const loadDescription = async (taskId: string) => {
    const { data } = await supabase.from("tasks").select("description").eq("id", taskId).maybeSingle();
    if (data) setDescriptions((prev) => ({ ...prev, [taskId]: data.description }));
  };
  // Keep the opened task in sync with realtime updates instead of remounting/closing the dialog
  const liveSelectedTask = useMemo(() => {
    if (!selectedTask) return selectedTask;
    const base = tasks.find((t) => t.id === selectedTask.id) ?? selectedTask;
    const desc = base.description ?? descriptions[selectedTask.id] ?? null;
    return { ...base, description: desc };
  }, [tasks, selectedTask, descriptions]) as Task;
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const formatDuration = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}ч ${m}м ${s}с`;
    if (m > 0) return `${m}м ${s}с`;
    return `${s}с`;
  };

  const columnConfig: { status: TaskStatus; label: string; dotClass: string }[] = [
    { status: "todo", label: t("kanban.todo"), dotClass: "bg-muted-foreground" },
    { status: "in_progress", label: t("kanban.inProgress"), dotClass: "bg-status-in-progress" },
    { status: "review", label: t("kanban.review"), dotClass: "bg-status-review" },
    { status: "corrections", label: t("kanban.corrections"), dotClass: "bg-accent" },
    { status: "done", label: t("kanban.done"), dotClass: "bg-status-done" },
  ];

  const columns = useMemo(() => {
    return columnConfig.map((col) => ({
      ...col,
      tasks: tasks.filter((t) => t.status === col.status),
    }));
  }, [tasks, t]);

  const handleDragStart = (taskId: string, e: React.DragEvent) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const isDropBlocked = (status: TaskStatus) => !isAdmin && status === "done";

  const handleDragOver = (status: TaskStatus, e: React.DragEvent) => {
    if (isDropBlocked(status)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "none";
      setDragOverColumn(status);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (status: TaskStatus) => {
    if (isDropBlocked(status)) {
      setDraggedTaskId(null);
      setDragOverColumn(null);
      return;
    }
    if (draggedTaskId) { onStatusChange(draggedTaskId, status); }
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const [mobileColumn, setMobileColumn] = useState<TaskStatus>("todo");

  return (
    <>
      {/* Mobile/tablet: tabs to switch between columns (single column visible) */}
      <div className="lg:hidden -mx-2 px-2 mb-3 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 min-w-max pb-1">
          {columnConfig.map((col) => {
            const count = tasks.filter((t) => t.status === col.status).length;
            const active = mobileColumn === col.status;
            return (
              <button
                key={col.status}
                onClick={() => setMobileColumn(col.status)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-md text-[13px] font-semibold whitespace-nowrap transition-colors border ${
                  active
                    ? "bg-primary/20 border-primary/50 text-foreground"
                    : "bg-card border-border text-muted-foreground"
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${col.dotClass}`} />
                {col.label}
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[12px] text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>
      </div>



      <div className="flex flex-col lg:grid lg:grid-cols-5 gap-2 sm:gap-4 h-auto lg:h-[calc(100vh-180px)]">
        {columns.map((col) => {
          const hiddenOnMobile = col.status !== mobileColumn;
          const isOver = dragOverColumn === col.status && draggedTaskId !== null;
          const draggedTask = draggedTaskId ? tasks.find(t => t.id === draggedTaskId) : null;
          const isSameColumn = draggedTask?.status === col.status;
          const blocked = isOver && !isSameColumn && isDropBlocked(col.status);

          return (
            <div
              key={col.status}
              className={`${hiddenOnMobile ? "hidden lg:flex" : "flex"} w-full lg:w-auto flex-col min-h-0 rounded-lg transition-all duration-200 ${
                blocked
                  ? "bg-destructive/5 ring-2 ring-destructive/40 ring-dashed opacity-60 cursor-not-allowed"
                  : isOver && !isSameColumn
                  ? "bg-primary/5 ring-2 ring-primary/30 ring-dashed"
                  : isOver && isSameColumn
                  ? "bg-muted/50"
                  : ""
              }`}
              onDragOver={(e) => handleDragOver(col.status, e)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(col.status)}
            >
              <div className="hidden lg:flex items-center justify-between px-1 pb-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.dotClass}`} />
                  <span className="text-[10px] sm:text-sm font-medium whitespace-nowrap">{col.label}</span>
                  <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{col.tasks.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1 text-muted-foreground hover:text-foreground transition-colors"><ArrowUp className="h-3.5 w-3.5" /></button>
                  {onCreateTask && (
                    <button onClick={() => onCreateTask(col.status)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><Plus className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 lg:space-y-2 p-1">
                {blocked && (
                  <div className="border-2 border-dashed border-destructive/40 rounded-lg p-4 text-center text-xs text-destructive animate-fade-in">
                    🚫 {t("kanban.onlyAdminDone")}
                  </div>
                )}
                {isOver && !isSameColumn && !blocked && col.tasks.length === 0 && (
                  <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 text-center text-xs text-muted-foreground animate-fade-in">
                    ↓ {t("kanban.dropHere")}
                  </div>
                )}
                {col.tasks.map((task) => {
                  const priority = (task as any).priority || "medium";
                  const pInfo = priorityIcons[priority as keyof typeof priorityIcons] || priorityIcons.medium;
                  const PIcon = pInfo.icon;
                  const isDragging = draggedTaskId === task.id;
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(task.id, e)}
                      onDragEnd={handleDragEnd}
                      onClick={() => {
                        if (!isDragging) {
                          const code = (task as any).task_code;
                          boardPathRef.current = window.location.pathname;
                          setSelectedTask(task);
                          loadDescription(task.id);
                          if (code) {
                            window.history.pushState({}, "", `/task/${code.replace("#", "")}`);
                          }
                        }
                      }}
                      className={`kanban-card w-full bg-card border border-border rounded-lg p-4 lg:p-3 cursor-grab hover:border-primary/30 group active:scale-[0.98] transition-transform ${
                        isDragging ? "opacity-40 scale-95 ring-2 ring-primary/40" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 lg:gap-1.5">
                        <GripVertical className="hidden lg:block h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                        <div className="flex-1 min-w-0">
                          {(task as any).task_code && <span className="text-[13px] lg:text-[11px] font-mono text-primary font-bold break-all leading-tight">{(task as any).task_code}</span>}
                          <h4 className="text-[15px] lg:text-sm font-semibold lg:font-medium leading-snug break-words whitespace-normal">{task.title}</h4>
                        </div>
                        <PIcon className={`h-5 w-5 lg:h-3.5 lg:w-3.5 shrink-0 mt-0.5 ${pInfo.className}`} />
                      </div>
                      <div className="flex items-center flex-wrap gap-1.5 lg:gap-1 mt-2.5 lg:mt-2">
                        {(task as any).direction && (
                          <Badge variant="outline" className="text-[12px] lg:text-[10px] px-2 lg:px-1.5 py-0 gap-1 lg:gap-0.5 h-7 lg:h-5">
                            <Folder className="h-3.5 w-3.5 lg:h-2.5 lg:w-2.5" />{(task as any).direction}
                          </Badge>
                        )}
                        {(task as any).complexity && (
                          <Badge variant="secondary" className="text-[12px] lg:text-[10px] px-2 lg:px-1.5 py-0 gap-1 lg:gap-0.5 h-7 lg:h-5">
                            <Clock className="h-3.5 w-3.5 lg:h-2.5 lg:w-2.5" />~{(task as any).complexity % 1 === 0 ? `${(task as any).complexity}ч` : `${Math.floor((task as any).complexity)}ч 30м`}
                          </Badge>
                        )}
                        {(task.status === "done" || task.status === "review") && (task as any).completed_at && (() => {
                          const start = (task as any).in_progress_at ? new Date((task as any).in_progress_at).getTime() : new Date(task.created_at).getTime();
                          const pausedTotal = Number((task as any).paused_total_ms || 0);
                          const ms = workingElapsedMs(start, new Date((task as any).completed_at).getTime()) - pausedTotal;
                          return ms > 0 ? (
                            <Badge variant="secondary" className="text-[12px] lg:text-[10px] px-2 lg:px-1.5 py-0 gap-1 lg:gap-0.5 h-7 lg:h-5 text-status-done">
                              <Timer className="h-3.5 w-3.5 lg:h-2.5 lg:w-2.5" />{formatDuration(ms)}
                            </Badge>
                          ) : null;
                        })()}
                        {showAssignee && userMap[task.user_id] && (
                          <span className="text-[12px] lg:text-xs text-muted-foreground font-mono truncate max-w-[140px] sm:max-w-[120px]">{userMap[task.user_id]}</span>
                        )}
                        <span className="text-[12px] lg:text-[10px] text-muted-foreground ml-auto">{format(new Date(task.updated_at), "dd.MM.yy HH:mm")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {selectedTask && (
        <TaskDetailDialog
          task={liveSelectedTask}
          open={!!selectedTask}
          onOpenChange={(o) => { if (!o) { setSelectedTask(null); closeUrl(); } }}
          assigneeName={userMap[liveSelectedTask.user_id]}
          onDeleted={() => { setSelectedTask(null); closeUrl(); onTaskDeleted?.(); }}
          onUpdated={() => { onTaskDeleted?.(); }}
          users={users}
        />
      )}
    </>
  );
}
