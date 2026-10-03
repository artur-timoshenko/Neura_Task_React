import { useEffect, useMemo, useState, useRef } from "react";
import { loadProjects, saveProjects } from "@/lib/projectsApi";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Trash2, FolderOpen, ChevronLeft, Users, Crown, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Project,
  ProjectTask,
  ProjectTaskStatus,
  ProjectTaskType,
  buildChildIndex,
  canCreateProject,
  canManageProject,
  canViewProject,
  exportProjectJSON,
  getDescendantIds,
  nowISO,
  projectProgress,
  uid,
} from "@/lib/projectTree";
import { ProjectTaskNode } from "@/components/ProjectTaskNode";
import { ProjectTaskDetailDialog } from "@/components/ProjectTaskDetailDialog";
import { ProjectMembersDialog } from "@/components/ProjectMembersDialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function ProjectsPage() {
  const { user, role } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | ProjectTaskStatus>("all");
  const [hideDone, setHideDone] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [rootTitle, setRootTitle] = useState("");
  const [rootEstimate, setRootEstimate] = useState("5");
  const [detailTask, setDetailTask] = useState<ProjectTask | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);

  const saving = useRef(false);
  useEffect(() => {
    let cancelled = false;
    loadProjects().then(data => { if (!cancelled) setProjects(data); })
      .catch(error => { if (!cancelled) toast.error(error.message); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const persist = async (next: Project[]) => {
    if (saving.current) { toast.error("Дождитесь сохранения предыдущего изменения"); return false; }
    saving.current = true;
    try {
      setProjects(await saveProjects(next, projects));
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
      try { setProjects(await loadProjects()); } catch { /* retain the last confirmed state */ }
      return false;
    } finally { saving.current = false; }
  };

  const active = useMemo(() => projects.find((p) => p.id === activeId) || null, [projects, activeId]);

  // Re-sync detailTask with the latest task data from active project (so updates re-render)
  const detailTaskLive = useMemo(() => {
    if (!detailTask || !active) return null;
    return active.tasks.find((t) => t.id === detailTask.id) || null;
  }, [detailTask, active]);

  const visibleProjects = useMemo(
    () => projects.filter((p) => canViewProject(p, user?.id, role as any)),
    [projects, user, role]
  );

  const updateActive = (mut: (p: Project) => Project) => {
    if (!active) return;
    const next = projects.map((p) => (p.id === active.id ? { ...mut(p), updatedAt: nowISO() } : p));
    persist(next);
  };

  const updateActivePatch = (patch: Partial<Project>) => {
    updateActive((p) => ({ ...p, ...patch }));
  };

  const handleCreateProject = async () => {
    if (!pName.trim()) return;
    if (!canCreateProject(role as any)) {
      toast.error("Только админ или тимлид могут создавать проекты");
      return;
    }
    const p: Project = {
      id: uid(),
      name: pName.trim(),
      description: pDesc.trim() || undefined,
      tasks: [],
      members: [],
      teamleadId: role === "teamlead" ? user?.id : undefined,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: user?.id,
    };
    if (!await persist([p, ...projects])) return;
    setPName("");
    setPDesc("");
    setActiveId(p.id);
    setCreateOpen(false);
    toast.success("Проект создан");
  };

  const handleAddRoot = () => {
    if (!active || !rootTitle.trim()) return;
    if (!canManageProject(active, user?.id, role as any)) {
      toast.error("Нет прав на добавление задач");
      return;
    }
    const t: ProjectTask = {
      id: uid(),
      parentId: null,
      title: rootTitle.trim(),
      type: "epic",
      status: "todo",
      estimate: parseFloat(rootEstimate) || 1,
      assignedUserIds: [],
      comments: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: user?.id,
    };
    updateActive((p) => ({ ...p, tasks: [...p.tasks, t] }));
    setRootTitle("");
    setRootEstimate("5");
  };

  const handleAddChild = (parent: ProjectTask, title: string, type: ProjectTaskType, estimate: number) => {
    if (!active || !canManageProject(active, user?.id, role as any)) {
      toast.error("Нет прав на добавление подзадач");
      return;
    }
    const t: ProjectTask = {
      id: uid(),
      parentId: parent.id,
      title,
      type,
      status: "todo",
      estimate,
      assignedUserIds: [],
      comments: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: user?.id,
    };
    updateActive((p) => ({ ...p, tasks: [...p.tasks, t] }));
  };

  const handleUpdateTask = (id: string, patch: Partial<ProjectTask>) => {
    updateActive((p) => ({
      ...p,
      tasks: p.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: nowISO() } : t)),
    }));
  };

  const handleDeleteTask = (id: string) => {
    if (!active || !canManageProject(active, user?.id, role as any)) return;
    const idx = buildChildIndex(active.tasks);
    const toRemove = new Set([id, ...getDescendantIds(id, idx)]);
    updateActive((p) => ({ ...p, tasks: p.tasks.filter((t) => !toRemove.has(t.id)) }));
  };

  const handleDeleteProject = (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    if (!canManageProject(p, user?.id, role as any)) {
      toast.error("Нет прав на удаление проекта");
      return;
    }
    if (!confirm("Удалить проект полностью?")) return;
    persist(projects.filter((p) => p.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const handleExport = () => {
    if (!active) return;
    const blob = new Blob([exportProjectJSON(active)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const roots = useMemo(() => {
    if (!active) return [];
    const idx = buildChildIndex(active.tasks);
    return (idx.get(null) || []).filter((r) => {
      if (hideDone && r.status === "done") return false;
      return true;
    });
  }, [active, hideDone]);

  const overallProgress = active ? projectProgress(active) : 0;
  const canCreate = canCreateProject(role as any);
  const canManageActive = active ? canManageProject(active, user?.id, role as any) : false;

  return (
    <AppShell>
      <div className="p-3 sm:p-6 max-w-5xl mx-auto">
        {!active ? (
          <>
            <div className="flex items-start sm:items-center justify-between gap-2 mb-6">
              <div>
                <h1 className="text-lg sm:text-2xl font-pixel tracking-tight">PROJECTS</h1>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  Иерархические проекты · комментарии · дедлайны · команды
                </p>
              </div>
              {canCreate && (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Новый</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Новый проект</DialogTitle>
                      <DialogDescription>Создайте корневой проект. Внутри можно строить иерархию любой глубины.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Название проекта" />
                      <Textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} placeholder="Описание (необязательно)" rows={3} />
                      <Button className="w-full" onClick={handleCreateProject} disabled={!pName.trim()}>Создать</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {visibleProjects.length === 0 ? (
              <div className="retro-inset bg-card p-12 text-center">
                <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground font-mono">
                  {canCreate ? "Проектов пока нет" : "Вы пока не добавлены ни в один проект"}
                </p>
                {canCreate && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">Нажмите «Новый» чтобы начать</p>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleProjects.map((p) => {
                  const prog = projectProgress(p);
                  const canManageThis = canManageProject(p, user?.id, role as any);
                  return (
                    <div
                      key={p.id}
                      className="retro-outset bg-card p-3 cursor-pointer hover:bg-card/80 transition-colors"
                      onClick={() => setActiveId(p.id)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm truncate">{p.name}</h3>
                          {p.description && (
                            <p className="text-xs text-muted-foreground font-mono line-clamp-2 mt-0.5">{p.description}</p>
                          )}
                        </div>
                        {canManageThis && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive shrink-0"
                            onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Progress value={prog} className="h-1.5 flex-1" />
                        <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{prog}%</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-mono">{p.tasks.length} задач</span>
                        <span className="text-[10px] text-muted-foreground font-mono inline-flex items-center gap-0.5">
                          <Users className="h-2.5 w-2.5" /> {p.members.length}
                        </span>
                        {p.teamleadId && (
                          <Badge variant="outline" className="text-[9px] gap-0.5">
                            <Crown className="h-2.5 w-2.5" /> teamlead
                          </Badge>
                        )}
                        {!canManageThis && (
                          <Badge variant="outline" className="text-[9px] gap-0.5">
                            <Lock className="h-2.5 w-2.5" /> read-only
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Button size="sm" variant="ghost" onClick={() => setActiveId(null)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Все проекты
              </Button>
            </div>

            <div className="retro-outset bg-card p-3 sm:p-4 mb-4">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-pixel tracking-tight break-words">{active.name}</h1>
                  {active.description && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">{active.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">
                    Создан: {new Date(active.createdAt).toLocaleString("ru-RU")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setMembersOpen(true)}>
                    <Users className="h-3.5 w-3.5" /> Участники ({active.members.length})
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport}>
                    <Download className="h-3.5 w-3.5" /> JSON
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={overallProgress} className="h-2 flex-1" />
                <span className="text-xs font-mono font-bold">{overallProgress}%</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mt-1">
                {active.tasks.length} задач · {active.tasks.filter((t) => t.status === "done").length} завершено
                {active.teamleadId && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <Crown className="h-2.5 w-2.5" /> Тимлид назначен
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant={hideDone ? "default" : "outline"}
                onClick={() => setHideDone(!hideDone)}
                className="text-xs h-8"
              >
                Скрыть выполненные
              </Button>
            </div>

            {canManageActive && (
              <div className="retro-inset bg-background p-2 sm:p-3 mb-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={rootTitle}
                    onChange={(e) => setRootTitle(e.target.value)}
                    placeholder="Новый Epic уровня 1..."
                    className="h-8 text-sm flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddRoot(); }}
                  />
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={rootEstimate}
                    onChange={(e) => setRootEstimate(e.target.value)}
                    className="h-8 text-sm w-full sm:w-24"
                    placeholder="estimate"
                  />
                  <Button size="sm" className="h-8 gap-1" onClick={handleAddRoot}>
                    <Plus className="h-3.5 w-3.5" /> Добавить
                  </Button>
                </div>
              </div>
            )}

            {roots.length === 0 ? (
              <div className="retro-inset bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground font-mono">Пока нет задач</p>
                {canManageActive && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">Добавьте первый Epic выше</p>
                )}
              </div>
            ) : (
              <div>
                {roots.map((r) => (
                  <ProjectTaskNode
                    key={r.id}
                    project={active}
                    task={r}
                    allTasks={active.tasks}
                    filterStatus={filterStatus}
                    hideDone={hideDone}
                    onAddChild={handleAddChild}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onOpenDetail={(t) => setDetailTask(t)}
                  />
                ))}
              </div>
            )}

            <ProjectTaskDetailDialog
              project={active}
              task={detailTaskLive}
              open={!!detailTask}
              onOpenChange={(v) => !v && setDetailTask(null)}
              onUpdate={handleUpdateTask}
            />

            <ProjectMembersDialog
              project={active}
              open={membersOpen}
              onOpenChange={setMembersOpen}
              onUpdate={updateActivePatch}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
