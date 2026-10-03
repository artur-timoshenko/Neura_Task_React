import { supabase, API_URL, PUBLIC_CLIENT_ID } from "@/integrations/supabase/client";

type NotifyTelegramPayload = {
  taskId: string;
  taskCode: string;
  taskTitle: string;
  userName: string;
  appUrl: string;
};

export async function notifyTelegramReview(payload: NotifyTelegramPayload) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("No active session. Please sign in again.");
  }

  const response = await fetch(`${API_URL}/functions/v1/notify-telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: PUBLIC_CLIENT_ID,
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let data: unknown = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    const errorMessage =
      typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
        ? data.error
        : `notify-telegram failed: ${response.status}`;

    throw new Error(errorMessage);
  }

  return data;
}

type CorrectionsPayload = {
  taskId: string;
  taskCode?: string | null;
  taskTitle?: string | null;
  designerName?: string | null;
  actorName?: string | null;
  comment?: string | null;
  appUrl: string;
};

/** Notifies the shared Telegram group that a task was sent back for corrections. */
export async function notifyTelegramCorrections(payload: CorrectionsPayload) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch(`${API_URL}/functions/v1/notify-telegram-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: PUBLIC_CLIENT_ID,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("Telegram corrections notify failed", e);
  }
}

/** Notifies the designer's bound Telegram group that a new task was assigned. */
export async function notifyTelegramNewTask(payload: { taskId: string; appUrl: string }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch(`${API_URL}/functions/v1/notify-telegram-new-task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: PUBLIC_CLIENT_ID,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("Telegram new task notify failed", e);
  }
}
