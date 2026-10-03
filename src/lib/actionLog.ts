import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logger } from "@/lib/logger";

type Json = Database["public"]["Functions"]["log_action"]["Args"]["_details"];

type ActionLogPayload = {
  action: string;
  entityType: string;
  entityId?: string | null;
  taskId?: string | null;
  targetUserId?: string | null;
  details?: Json;
};

type QueuedEvent = {
  action: string;
  entity_type: string;
  entity_id: string | null;
  task_id: string | null;
  target_user_id: string | null;
  details: Json;
  created_at: string;
};

const FLUSH_INTERVAL_MS = 4000;
const MAX_BATCH_SIZE = 25;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let unloadHookInstalled = false;

function installUnloadHook() {
  if (unloadHookInstalled || typeof window === "undefined") return;
  unloadHookInstalled = true;
  // Best-effort flush before navigation/close
  window.addEventListener("pagehide", () => { void flushNow(); });
  window.addEventListener("beforeunload", () => { void flushNow(); });
}

async function flushNow() {
  if (queue.length === 0) return;
  const events = queue;
  queue = [];
  if (timer) { clearTimeout(timer); timer = null; }
  const { error } = await supabase.rpc("log_actions_batch", {
    _events: events as unknown as Json,
  });
  if (error) {
    logger.error("Failed to flush action log batch", error);
    // Re-queue for next flush attempt
    queue = events.concat(queue);
  }
}

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; void flushNow(); }, FLUSH_INTERVAL_MS);
}

export async function logAction(payload: ActionLogPayload) {
  installUnloadHook();
  queue.push({
    action: payload.action,
    entity_type: payload.entityType,
    entity_id: payload.entityId ?? null,
    task_id: payload.taskId ?? null,
    target_user_id: payload.targetUserId ?? null,
    details: (payload.details ?? {}) as Json,
    created_at: new Date().toISOString(),
  });

  if (queue.length >= MAX_BATCH_SIZE) {
    void flushNow();
  } else {
    scheduleFlush();
  }
}

export const __actionLogTestables = { flushNow };
