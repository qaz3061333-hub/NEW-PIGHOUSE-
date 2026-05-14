export const SANDBOX_ABNORMAL_ALERT_EVENTS_KEY = "new_pighouse_sandbox_abnormal_alert_events_v1";

export type SandboxAbnormalAlertEvent = {
  id: string;
  source: "conversation_logs";
  severity: "low" | "medium" | "high";
  title: string;
  summary: string;
  customer_message: string;
  created_at: string;
  is_resolved: boolean;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function safeParseEvents(value: string | null): SandboxAbnormalAlertEvent[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SandboxAbnormalAlertEvent => {
      return Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as SandboxAbnormalAlertEvent).id === "string" &&
          (item as SandboxAbnormalAlertEvent).source === "conversation_logs" &&
          typeof (item as SandboxAbnormalAlertEvent).severity === "string" &&
          typeof (item as SandboxAbnormalAlertEvent).title === "string" &&
          typeof (item as SandboxAbnormalAlertEvent).summary === "string" &&
          typeof (item as SandboxAbnormalAlertEvent).customer_message === "string" &&
          typeof (item as SandboxAbnormalAlertEvent).created_at === "string" &&
          typeof (item as SandboxAbnormalAlertEvent).is_resolved === "boolean",
      );
    });
  } catch {
    return [];
  }
}

export function listSandboxAbnormalAlertEvents(): SandboxAbnormalAlertEvent[] {
  if (!hasWindow()) return [];
  const stored = window.localStorage.getItem(SANDBOX_ABNORMAL_ALERT_EVENTS_KEY);
  return safeParseEvents(stored).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function appendSandboxAbnormalAlertEvent(event: SandboxAbnormalAlertEvent): SandboxAbnormalAlertEvent[] {
  if (!hasWindow()) return [];
  const next = [event, ...listSandboxAbnormalAlertEvents()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  window.localStorage.setItem(SANDBOX_ABNORMAL_ALERT_EVENTS_KEY, JSON.stringify(next));
  return next;
}

export function markSandboxAbnormalAlertEventResolved(id: string): SandboxAbnormalAlertEvent[] {
  if (!hasWindow()) return [];
  const next = listSandboxAbnormalAlertEvents().map((event) =>
    event.id === id ? { ...event, is_resolved: true } : event,
  );
  window.localStorage.setItem(SANDBOX_ABNORMAL_ALERT_EVENTS_KEY, JSON.stringify(next));
  return next;
}

export function clearSandboxAbnormalAlertEvents() {
  if (!hasWindow()) return;
  window.localStorage.removeItem(SANDBOX_ABNORMAL_ALERT_EVENTS_KEY);
}
