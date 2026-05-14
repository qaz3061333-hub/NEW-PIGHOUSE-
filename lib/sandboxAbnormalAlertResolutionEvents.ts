export const SANDBOX_ABNORMAL_ALERT_RESOLUTION_EVENTS_KEY = "new_pighouse_sandbox_abnormal_alert_resolution_events_v1";

export type SandboxAbnormalAlertResolutionEvent = {
  id: string;
  source: "abnormal_alerts";
  abnormal_alert_id: string;
  title: string;
  severity: "low" | "medium" | "high";
  summary: string;
  customer_message: string;
  resolution_note: string;
  created_at: string;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function safeParse(value: string | null): SandboxAbnormalAlertResolutionEvent[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SandboxAbnormalAlertResolutionEvent => {
      const row = item as SandboxAbnormalAlertResolutionEvent;
      return Boolean(
        row && typeof row.id === "string" && row.source === "abnormal_alerts" &&
        typeof row.abnormal_alert_id === "string" && typeof row.title === "string" &&
        typeof row.severity === "string" && typeof row.summary === "string" &&
        typeof row.customer_message === "string" && typeof row.resolution_note === "string" &&
        typeof row.created_at === "string",
      );
    });
  } catch {
    return [];
  }
}

export function listSandboxAbnormalAlertResolutionEvents(): SandboxAbnormalAlertResolutionEvent[] {
  if (!hasWindow()) return [];
  return safeParse(window.localStorage.getItem(SANDBOX_ABNORMAL_ALERT_RESOLUTION_EVENTS_KEY)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function appendSandboxAbnormalAlertResolutionEvent(event: SandboxAbnormalAlertResolutionEvent) {
  if (!hasWindow()) return [];
  const next = [event, ...listSandboxAbnormalAlertResolutionEvents()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  window.localStorage.setItem(SANDBOX_ABNORMAL_ALERT_RESOLUTION_EVENTS_KEY, JSON.stringify(next));
  return next;
}

export function clearSandboxAbnormalAlertResolutionEvents() {
  if (!hasWindow()) return;
  window.localStorage.removeItem(SANDBOX_ABNORMAL_ALERT_RESOLUTION_EVENTS_KEY);
}
