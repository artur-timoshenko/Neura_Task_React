import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

/**
 * Columns needed to render kanban cards / board lists.
 * `description` is intentionally excluded — it is the heaviest column and is
 * only needed when a task is opened.
 */
export const TASK_LIST_FIELDS =
  "id,title,status,user_id,created_by,created_at,updated_at,priority,direction,task_code,in_progress_at,completed_at,complexity,paused_at,paused_total_ms,board,buyer_id";

/** Board rows never carry `description`. */
export type BoardTask = Omit<Task, "description"> & { description?: string | null };

/** Columns needed for user pickers / name maps. */
export const PROFILE_LIST_FIELDS = "id,name,email,avatar_url,tags,banned,created_at,updated_at";

/** Cutoff (ISO) for the 14-day archive rule. */
export function archiveCutoffIso(daysAgo = 14) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

/** A task is archived when it is done and its reference date is older than the cutoff. */
export function isArchived(t: Pick<Task, "status" | "completed_at" | "created_at">, cutoffMs: number) {
  if (t.status !== "done") return false;
  const ref = t.completed_at ? new Date(t.completed_at).getTime() : new Date(t.created_at).getTime();
  return ref < cutoffMs;
}
