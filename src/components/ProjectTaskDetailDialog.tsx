import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import { RichDescription } from "@/components/RichDescription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Send, Calendar as CalendarIcon } from "lucide-react";
import {
  Project,
  ProjectComment,
  ProjectTask,
  ProjectTaskStatus,
  canCommentOnTask,
  canEditTask,
  canManageProject,
  isTaskAssignee,
  nowISO,
  uid,
} from "@/lib/projectTree";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  project: Project;
  task: ProjectTask | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdate: (id: string, patch: Partial<ProjectTask>) => void;
}

export function ProjectTaskDetailDialog({ project, task, open, onOpenChange, onUpdate }: Props) {
  const { user, role, profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimate, setEstimate] = useState("1");
  const [status, setStatus] = useState<ProjectTaskStatus>("todo");
  const [assigned, setAssigned] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description || "");
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setEstimate(String(task.estimate));
    setStatus(task.status);
    setAssigned(task.assignedUserIds || []);
    setComment("");
  }, [task]);

  if (!task) return null;

  const canEdit = canEditTask(project, task, user?.id, role as any);
  const canComment = canCommentOnTask(project, task, user?.id, role as any);
  const canManage = canManageProject(project, user?.id, role as any);
  const isAssignee = isTaskAssignee(task, user?.id);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Название обязательно");
      return;
    }
    const patch: Partial<ProjectTask> = {
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      status,
    };
    // Only managers can change estimate & assignees
    if (canManage) {
      patch.estimate = parseFloat(estimate) || 1;
      patch.assignedUserIds = assigned;
    }
    onUpdate(task.id, patch);
    toast.success("Сохранено");
    onOpenChange(false);
  };

  const handleAddComment = () => {
    if (!comment.trim() || !user) return;
    const c: ProjectComment = {
      id: uid(),
      authorId: user.id,
      authorName: profile?.name || user.email || "Anon",
      content: comment.trim(),
      createdAt: nowISO(),
    };
    onUpdate(task.id, { comments: [...(task.comments || []), c] });
    setComment("");
  };

  const handleDeleteComment = (id: string) => {
    onUpdate(task.id, { comments: (task.comments || []).filter((c) => c.id !== id) });
  };

  const toggleAssign = (uid: string) => {
    setAssigned((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  };

  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-pixel text-sm break-words">{task.title}</DialogTitle>
          <DialogDescription className="font-mono text-[10px]">
            Создано: {new Date(task.createdAt).toLocaleString("ru-RU")} · Обновлено: {new Date(task.updatedAt).toLocaleString("ru-RU")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-pixel text-muted-foreground">НАЗВАНИЕ</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} className="mt-1" />
          </div>

          <div>
            <label className="text-[10px] font-pixel text-muted-foreground">ОПИСАНИЕ</label>
            {canEdit ? (
              <RichTextEditor
                value={description}
                onChange={setDescription}
                rows={5}
                className="mt-1"
                placeholder="Опишите задачу подробно..."
              />
            ) : (
              <div className="mt-1 p-3 border border-input rounded-md bg-muted/30 text-xs min-h-[80px]">
                {description.trim() ? <RichDescription>{description}</RichDescription> : <span className="text-muted-foreground">Нет описания</span>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-pixel text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" /> ДЕДЛАЙН
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!canEdit}
                className="mt-1 text-xs"
              />
              {overdue && <p className="text-[10px] text-destructive font-mono mt-1">Просрочено</p>}
            </div>
            <div>
              <label className="text-[10px] font-pixel text-muted-foreground">СТАТУС</label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectTaskStatus)} disabled={!canEdit}>
                <SelectTrigger className="mt-1 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-pixel text-muted-foreground">ESTIMATE</label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                disabled={!canManage}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          {/* Assignees */}
          <div>
            <label className="text-[10px] font-pixel text-muted-foreground">ИСПОЛНИТЕЛИ</label>
            {project.members.length === 0 ? (
              <p className="text-[10px] text-muted-foreground font-mono mt-1">
                В проекте ещё нет работников. Откройте «Участники» чтобы добавить.
              </p>
            ) : (
              <div className="mt-1 retro-inset bg-background p-2 max-h-32 overflow-y-auto space-y-1">
                {project.members.map((m) => (
                  <label
                    key={m.userId}
                    className={`flex items-center gap-2 text-xs font-mono p-1 ${canManage ? "cursor-pointer hover:bg-accent/50" : "opacity-70"}`}
                  >
                    <Checkbox
                      checked={assigned.includes(m.userId)}
                      onCheckedChange={() => canManage && toggleAssign(m.userId)}
                      disabled={!canManage}
                    />
                    <span className="truncate">{m.name}</span>
                    {m.email && <span className="text-muted-foreground text-[10px] truncate">({m.email})</span>}
                  </label>
                ))}
              </div>
            )}
            {!canManage && assigned.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {assigned.map((id) => {
                  const m = project.members.find((x) => x.userId === id);
                  return m ? (
                    <Badge key={id} variant="secondary" className="text-[10px]">{m.name}</Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>

          {/* Comments */}
          <div>
            <label className="text-[10px] font-pixel text-muted-foreground">КОММЕНТАРИИ ({(task.comments || []).length})</label>
            <div className="mt-1 retro-inset bg-background p-2 max-h-48 overflow-y-auto space-y-2">
              {(task.comments || []).length === 0 ? (
                <p className="text-[10px] text-muted-foreground font-mono text-center py-2">Пока нет комментариев</p>
              ) : (
                (task.comments || []).map((c) => (
                  <div key={c.id} className="bg-card p-2 retro-outset">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-pixel text-[9px] text-primary truncate">{c.authorName}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {new Date(c.createdAt).toLocaleString("ru-RU")}
                        </span>
                      </div>
                      {(canManage || c.authorId === user?.id) && (
                        <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => handleDeleteComment(c.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs font-mono break-words whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))
              )}
            </div>
            {canComment ? (
              <div className="flex gap-1.5 mt-2">
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Добавить комментарий..."
                  className="text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                />
                <Button size="icon" onClick={handleAddComment} disabled={!comment.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground font-mono mt-2">
                Комментировать могут менеджеры проекта или назначенные на задачу.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
          {canEdit && <Button onClick={handleSave}>Сохранить</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
