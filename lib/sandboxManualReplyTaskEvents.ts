import type { SandboxManualTaskType, SandboxTriageResult } from "@/lib/sandboxCustomerServiceTriage";

export const SANDBOX_MANUAL_REPLY_TASK_EVENTS_KEY = "new_pighouse_sandbox_manual_reply_task_events_v1";

export type SandboxManualReplyTaskEvent = {
  id: string;
  source: "conversation_logs";
  customer: string;
  source_channel: string;
  triage_result?: SandboxTriageResult;
  classification_reason?: string;
  task_type?: SandboxManualTaskType;
  topic: string;
  last_message: string;
  auto_replied?: boolean;
  suggested_reply?: string;
  reply_note: string;
  waiting_minutes: number;
  priority: "urgent" | "normal";
  status?: "open" | "in_progress" | "replied";
  knowledge_fallback_reason?: string;
  is_sandbox?: boolean;
  created_at: string;
  is_replied: boolean;
  replied_at: string | null;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function safeParse(value: string | null): SandboxManualReplyTaskEvent[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SandboxManualReplyTaskEvent => {
      const row = item as SandboxManualReplyTaskEvent;
      return Boolean(
        row && typeof row.id === "string" && row.source === "conversation_logs" &&
        typeof row.customer === "string" && typeof row.source_channel === "string" &&
        typeof row.topic === "string" && typeof row.last_message === "string" &&
        typeof row.reply_note === "string" && typeof row.waiting_minutes === "number" &&
        (row.priority === "urgent" || row.priority === "normal") &&
        typeof row.created_at === "string" && typeof row.is_replied === "boolean" &&
        (typeof row.replied_at === "string" || row.replied_at === null),
      );
    });
  } catch {
    return [];
  }
}

export function listSandboxManualReplyTaskEvents(): SandboxManualReplyTaskEvent[] {
  if (!hasWindow()) return [];
  return safeParse(window.localStorage.getItem(SANDBOX_MANUAL_REPLY_TASK_EVENTS_KEY)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function appendSandboxManualReplyTaskEvent(event: SandboxManualReplyTaskEvent): SandboxManualReplyTaskEvent[] {
  if (!hasWindow()) return [];
  const next = [event, ...listSandboxManualReplyTaskEvents()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  window.localStorage.setItem(SANDBOX_MANUAL_REPLY_TASK_EVENTS_KEY, JSON.stringify(next));
  return next;
}

export function markSandboxManualReplyTaskEventReplied(id: string, repliedAt: string): SandboxManualReplyTaskEvent[] {
  if (!hasWindow()) return [];
  const next = listSandboxManualReplyTaskEvents().map((event) =>
    event.id === id ? { ...event, is_replied: true, replied_at: repliedAt, status: "replied" as const } : event,
  );
  window.localStorage.setItem(SANDBOX_MANUAL_REPLY_TASK_EVENTS_KEY, JSON.stringify(next));
  return next;
}

export function clearSandboxManualReplyTaskEvents() {
  if (!hasWindow()) return;
  window.localStorage.removeItem(SANDBOX_MANUAL_REPLY_TASK_EVENTS_KEY);
}
