export const SANDBOX_MANUAL_REPLY_RESOLUTION_EVENTS_KEY = "new_pighouse_sandbox_manual_reply_resolution_events_v1";

export type SandboxManualReplyResolutionEvent = {
  id: string;
  source: "manual_reply_tasks";
  manual_reply_task_id: string;
  customer: string;
  topic: string;
  last_message: string;
  reply_note: string;
  resolution_note: string;
  created_at: string;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function safeParse(value: string | null): SandboxManualReplyResolutionEvent[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SandboxManualReplyResolutionEvent => {
      const row = item as SandboxManualReplyResolutionEvent;
      return Boolean(
        row && typeof row.id === "string" && row.source === "manual_reply_tasks" &&
        typeof row.manual_reply_task_id === "string" && typeof row.customer === "string" &&
        typeof row.topic === "string" && typeof row.last_message === "string" &&
        typeof row.reply_note === "string" && typeof row.resolution_note === "string" &&
        typeof row.created_at === "string",
      );
    });
  } catch {
    return [];
  }
}

export function listSandboxManualReplyResolutionEvents(): SandboxManualReplyResolutionEvent[] {
  if (!hasWindow()) return [];
  return safeParse(window.localStorage.getItem(SANDBOX_MANUAL_REPLY_RESOLUTION_EVENTS_KEY)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function appendSandboxManualReplyResolutionEvent(event: SandboxManualReplyResolutionEvent) {
  if (!hasWindow()) return [];
  const next = [event, ...listSandboxManualReplyResolutionEvents()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  window.localStorage.setItem(SANDBOX_MANUAL_REPLY_RESOLUTION_EVENTS_KEY, JSON.stringify(next));
  return next;
}

export function clearSandboxManualReplyResolutionEvents() {
  if (!hasWindow()) return;
  window.localStorage.removeItem(SANDBOX_MANUAL_REPLY_RESOLUTION_EVENTS_KEY);
}
