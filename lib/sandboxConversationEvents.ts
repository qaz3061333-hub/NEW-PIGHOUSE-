export const SANDBOX_CONVERSATION_EVENTS_KEY = "new_pighouse_sandbox_conversation_events_v1";

export type SandboxConversationEvent = {
  id: string;
  source: "appointment_requests";
  appointment_request_id: string;
  appointment_status: "confirmed" | "proposed_new_time" | "rejected";
  role: "assistant";
  content: string;
  owner_name?: string;
  pet_name?: string;
  service?: string;
  created_at: string;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function safeParseEvents(value: string | null): SandboxConversationEvent[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SandboxConversationEvent => {
      return Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as SandboxConversationEvent).id === "string" &&
          typeof (item as SandboxConversationEvent).appointment_request_id === "string" &&
          typeof (item as SandboxConversationEvent).appointment_status === "string" &&
          typeof (item as SandboxConversationEvent).content === "string" &&
          typeof (item as SandboxConversationEvent).created_at === "string",
      );
    });
  } catch {
    return [];
  }
}

export function listSandboxConversationEvents(): SandboxConversationEvent[] {
  if (!hasWindow()) return [];
  const stored = window.localStorage.getItem(SANDBOX_CONVERSATION_EVENTS_KEY);
  return safeParseEvents(stored).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function appendSandboxConversationEvent(event: SandboxConversationEvent): SandboxConversationEvent[] {
  if (!hasWindow()) return [];

  const existing = listSandboxConversationEvents();
  const filtered = existing.filter(
    (item) =>
      !(item.appointment_request_id === event.appointment_request_id && item.appointment_status === event.appointment_status),
  );
  const next = [event, ...filtered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  window.localStorage.setItem(SANDBOX_CONVERSATION_EVENTS_KEY, JSON.stringify(next));
  return next;
}

export function clearSandboxConversationEvents() {
  if (!hasWindow()) return;
  window.localStorage.removeItem(SANDBOX_CONVERSATION_EVENTS_KEY);
}

export function removeSandboxConversationEvent(id: string): SandboxConversationEvent[] {
  if (!hasWindow()) return [];
  const next = listSandboxConversationEvents().filter((event) => event.id !== id);
  window.localStorage.setItem(SANDBOX_CONVERSATION_EVENTS_KEY, JSON.stringify(next));
  return next;
}
