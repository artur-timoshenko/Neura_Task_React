// Local-only hierarchical project task model with unlimited depth.
// Storage: localStorage. No backend, no sync between users.

export type ProjectTaskStatus = "todo" | "in-progress" | "done" | "blocked";
export type ProjectTaskType = "epic" | "feature" | "task" | "subtask";

export interface ProjectComment {
  id: string;
  authorId: string;     // user.id
  authorName: string;   // cached display name
  content: string;
  createdAt: string;
}

export interface ProjectMember {
  userId: string;
  name: string;
  email?: string;
}

export interface ProjectTask {
  id: string;
  parentId: string | null;
  title: string;
  description?: string;
  type: ProjectTaskType;
  status: ProjectTaskStatus;
  estimate: number; // weight
  assignedUserIds?: string[]; // members assigned to this task
  dueDate?: string;           // ISO date
  comments?: ProjectComment[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string; // user id
  collapsed?: boolean;
}

export interface Project {
  _version?: number; // Server optimistic-lock version
  id: string;
  name: string;
  description?: string;
  tasks: ProjectTask[];
  teamleadId?: string;            // assigned teamlead user id
  members: ProjectMember[];       // members on the project (workers)
  createdAt: string;
  updatedAt: string;
  createdBy?: string;             // user id of creator
}

const STORAGE_KEY = "neura.projects.v1";

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Project[];
    // Migrate legacy projects (ensure new fields exist)
    return parsed.map((p) => ({
      ...p,
      members: p.members || [],
      tasks: (p.tasks || []).map((t) => ({
        ...t,
        comments: t.comments || [],
        assignedUserIds: t.assignedUserIds || [],
      })),
    }));
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function nowISO(): string {
  return new Date().toISOString();
}

// Build child index for fast lookups
export function buildChildIndex(tasks: ProjectTask[]): Map<string | null, ProjectTask[]> {
  const map = new Map<string | null, ProjectTask[]>();
  for (const t of tasks) {
    const arr = map.get(t.parentId) || [];
    arr.push(t);
    map.set(t.parentId, arr);
  }
  return map;
}

export function computeProgress(taskId: string, childIndex: Map<string | null, ProjectTask[]>, taskById: Map<string, ProjectTask>): number {
  const children = childIndex.get(taskId) || [];
  if (children.length === 0) {
    const t = taskById.get(taskId)!;
    if (t.status === "done") return 100;
    if (t.status === "in-progress") return 50;
    return 0;
  }
  let totalW = 0;
  let acc = 0;
  for (const c of children) {
    const w = Math.max(0.0001, c.estimate || 1);
    totalW += w;
    acc += w * computeProgress(c.id, childIndex, taskById);
  }
  return totalW === 0 ? 0 : Math.round((acc / totalW) * 10) / 10;
}

export function getDescendantIds(taskId: string, childIndex: Map<string | null, ProjectTask[]>): string[] {
  const out: string[] = [];
  const stack = [taskId];
  while (stack.length) {
    const id = stack.pop()!;
    const ch = childIndex.get(id) || [];
    for (const c of ch) {
      out.push(c.id);
      stack.push(c.id);
    }
  }
  return out;
}

export function aggregateEstimate(taskId: string, childIndex: Map<string | null, ProjectTask[]>, taskById: Map<string, ProjectTask>): number {
  const children = childIndex.get(taskId) || [];
  if (children.length === 0) return taskById.get(taskId)?.estimate || 0;
  return children.reduce((sum, c) => sum + aggregateEstimate(c.id, childIndex, taskById), 0);
}

export function projectProgress(p: Project): number {
  const childIndex = buildChildIndex(p.tasks);
  const taskById = new Map(p.tasks.map((t) => [t.id, t]));
  const roots = childIndex.get(null) || [];
  if (roots.length === 0) return 0;
  let totalW = 0;
  let acc = 0;
  for (const r of roots) {
    const w = Math.max(0.0001, aggregateEstimate(r.id, childIndex, taskById) || r.estimate || 1);
    totalW += w;
    acc += w * computeProgress(r.id, childIndex, taskById);
  }
  return totalW === 0 ? 0 : Math.round((acc / totalW) * 10) / 10;
}

export function nextChildType(parentType: ProjectTaskType | null): ProjectTaskType {
  switch (parentType) {
    case null:
    case undefined:
      return "epic";
    case "epic":
      return "feature";
    case "feature":
      return "task";
    case "task":
    case "subtask":
      return "subtask";
    default:
      return "subtask";
  }
}

export function exportProjectJSON(project: Project): string {
  const childIndex = buildChildIndex(project.tasks);
  const taskById = new Map(project.tasks.map((t) => [t.id, t]));
  const build = (id: string): any => {
    const t = taskById.get(id)!;
    const children = (childIndex.get(id) || []).map((c) => build(c.id));
    return {
      ...t,
      progress: computeProgress(id, childIndex, taskById),
      children,
    };
  };
  const roots = (childIndex.get(null) || []).map((r) => build(r.id));
  return JSON.stringify(
    {
      id: project.id,
      name: project.name,
      description: project.description,
      teamleadId: project.teamleadId,
      members: project.members,
      progress: projectProgress(project),
      roots,
    },
    null,
    2
  );
}

// ===== Permissions =====
// Roles: 'admin' | 'teamlead' | 'user' (matches AuthContext role)
export type AppRoleLite = "admin" | "teamlead" | "user" | null | undefined;

export function canCreateProject(role: AppRoleLite): boolean {
  return role === "admin" || role === "teamlead";
}

export function canManageProject(project: Project, userId: string | undefined, role: AppRoleLite): boolean {
  if (!userId) return false;
  if (role === "admin") return true;
  // Teamlead assigned to this project can manage members & tasks
  if (role === "teamlead" && project.teamleadId === userId) return true;
  // Creator can always manage their own project
  if (project.createdBy === userId) return true;
  return false;
}

export function canAssignTeamlead(role: AppRoleLite): boolean {
  return role === "admin";
}

export function canViewProject(project: Project, userId: string | undefined, role: AppRoleLite): boolean {
  if (!userId) return false;
  if (canManageProject(project, userId, role)) return true;
  // Worker assigned to project (via members)
  return project.members.some((m) => m.userId === userId);
}

export function isTaskAssignee(task: ProjectTask, userId: string | undefined): boolean {
  if (!userId) return false;
  return (task.assignedUserIds || []).includes(userId);
}

export function canEditTask(project: Project, task: ProjectTask, userId: string | undefined, role: AppRoleLite): boolean {
  if (canManageProject(project, userId, role)) return true;
  return isTaskAssignee(task, userId);
}

export function canCommentOnTask(project: Project, task: ProjectTask, userId: string | undefined, role: AppRoleLite): boolean {
  if (canManageProject(project, userId, role)) return true;
  return isTaskAssignee(task, userId);
}
