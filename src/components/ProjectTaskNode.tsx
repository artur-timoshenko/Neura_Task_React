import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, MessageSquare, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Project,
  ProjectTask,
  ProjectTaskStatus,
  ProjectTaskType,
  buildChildIndex,
  canEditTask,
  canManageProject,
  computeProgress,
  nextChildType,
} from "@/lib/projectTree";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  project: Project;
  task: ProjectTask;
  allTasks: ProjectTask[];
  filterStatus: "all" | ProjectTaskStatus;
  hideDone: boolean;
  onAddChild: (parent: ProjectTask, title: string, type: ProjectTaskType, estimate: number) => void;
  onUpdate: (id: string, patch: Partial<ProjectTask>) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (task: ProjectTask) => void;
  depth?: number;
}

const STATUS_STYLES: Record<ProjectTaskStatus, string> = {
  todo: "bg-muted text-muted-foreground border-border",
  "in-progress": "bg-primary/20 text-primary border-primary/40",
  done: "bg-green-500/20 text-green-400 border-green-500/40",
  blocked: "bg-destructive/20 text-destructive border-destructive/40",
};

const TYPE_LABEL: Record<ProjectTaskType, string> = {
  epic: "📦 EPIC",
  feature: "🧩 FEATURE",
  task: "🔧 TASK",
  subtask: "• SUB",
};

export function ProjectTaskNode({
  project,
  task,
  allTasks,
  filterStatus,
  hideDone,
  onAddChild,
  onUpdate,
  onDelete,
  onOpenDetail,
  depth = 0,
}: Props) {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEstimate, setNewEstimate] = useState("1");

  const childIndex = useMemo(() => buildChildIndex(allTasks), [allTasks]);
  const taskById = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);
  const progress = computeProgress(task.id, childIndex, taskById);
  const children = childIndex.get(task.id) || [];

  const canManage = canManageProject(project, user?.id, role as any);
  const canEdit = canEditTask(project, task, user?.id, role as any);

  const visibleChildren = children.filter((c) => {
    if (hideDone && c.status === "done") return false;
    if (filterStatus !== "all" && c.status !== filterStatus) {
      const descMatches = allTasks.filter((t) => t.parentId === c.id).some((d) => d.status === filterStatus);
      if (!descMatches) return false;
    }
    return true;
  });

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAddChild(task, newTitle.trim(), nextChildType(task.type), parseFloat(newEstimate) || 1);
    setNewTitle("");
    setNewEstimate("1");
    setAdding(false);
  };

  const commentCount = (task.comments || []).length;
  const assignedCount = (task.assignedUserIds || []).length;
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";

  return (
    <div className="border-l-2 border-border/50 pl-2 sm:pl-3 ml-1" style={{ marginLeft: depth === 0 ? 0 : 6 }}>
      <div className="retro-outset bg-card p-2 sm:p-3 my-1.5">
        <div className="flex items-start gap-2">
          <button
            onClick={() => setOpen(!open)}
            className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {children.length > 0 ? (
              open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <span className="inline-block w-4" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="font-pixel text-[8px] text-primary">{TYPE_LABEL[task.type]}</span>
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-pixel ${STATUS_STYLES[task.status]}`}>
                {task.status.toUpperCase()}
              </Badge>
              <span className="text-[10px] text-muted-foreground font-mono">est: {task.estimate}</span>
              {children.length > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">{children.length} sub</span>
              )}
              {commentCount > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono inline-flex items-center gap-0.5">
                  <MessageSquare className="h-2.5 w-2.5" /> {commentCount}
                </span>
              )}
              {assignedCount > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono inline-flex items-center gap-0.5">
                  <Users className="h-2.5 w-2.5" /> {assignedCount}
                </span>
              )}
              {task.dueDate && (
                <span className={`text-[10px] font-mono inline-flex items-center gap-0.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                  <Calendar className="h-2.5 w-2.5" /> {new Date(task.dueDate).toLocaleDateString("ru-RU")}
                </span>
              )}
            </div>

            <button
              type="button"
              className="text-sm font-medium break-words text-left hover:text-primary transition-colors w-full"
              onClick={() => onOpenDetail(task)}
            >
              {task.title}
            </button>

            {task.description && (
              <p className="text-xs text-muted-foreground mt-1 font-mono break-words line-clamp-2">{task.description}</p>
            )}

            <div className="flex items-center gap-2 mt-2">
              <Progress value={progress} className="h-1.5 flex-1" />
              <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{progress}%</span>
            </div>

            <div className="flex flex-wrap items-center gap-1 mt-2">
              <Select
                value={task.status}
                onValueChange={(v) => onUpdate(task.id, { status: v as ProjectTaskStatus })}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-7 w-[120px] text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>

              {canManage && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1" onClick={() => setAdding(!adding)}>
                  <Plus className="h-3 w-3" /> sub
                </Button>
              )}
              {canManage && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Удалить «${task.title}» и все вложенные?`)) onDelete(task.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>

            {adding && canManage && (
              <div className="mt-2 p-2 retro-inset bg-background flex flex-col sm:flex-row gap-1.5">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={`Новая ${nextChildType(task.type)}...`}
                  className="h-7 text-xs flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  autoFocus
                />
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={newEstimate}
                  onChange={(e) => setNewEstimate(e.target.value)}
                  className="h-7 text-xs w-full sm:w-20"
                  placeholder="est"
                />
                <Button size="sm" className="h-7 text-[10px]" onClick={handleAdd}>OK</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {open && visibleChildren.length > 0 && (
        <div className="ml-2 sm:ml-3">
          {visibleChildren.map((c) => (
            <ProjectTaskNode
              key={c.id}
              project={project}
              task={c}
              allTasks={allTasks}
              filterStatus={filterStatus}
              hideDone={hideDone}
              onAddChild={onAddChild}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onOpenDetail={onOpenDetail}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
