export const SANDBOX_CUSTOMER_RESCHEDULE_EVENTS_KEY = "new_pighouse_sandbox_customer_reschedule_events_v1";

export type SandboxCustomerRescheduleEvent = {
  id: string;
  appointment_request_id: string;
  source: "customer_reschedule_request";
  old_requested_at: string;
  new_requested_at: string;
  customer_message: string;
  staff_note: string;
  created_at: string;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function safeParse(value: string | null): SandboxCustomerRescheduleEvent[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SandboxCustomerRescheduleEvent => {
      const row = item as SandboxCustomerRescheduleEvent;
      return Boolean(
        row && typeof row.id === "string" && typeof row.appointment_request_id === "string" && row.source === "customer_reschedule_request" &&
          typeof row.old_requested_at === "string" && typeof row.new_requested_at === "string" && typeof row.customer_message === "string" && typeof row.staff_note === "string" && typeof row.created_at === "string",
      );
    });
  } catch {
    return [];
  }
}

export function listSandboxCustomerRescheduleEvents(): SandboxCustomerRescheduleEvent[] {
  if (!hasWindow()) return [];
  return safeParse(window.localStorage.getItem(SANDBOX_CUSTOMER_RESCHEDULE_EVENTS_KEY)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function appendSandboxCustomerRescheduleEvent(event: SandboxCustomerRescheduleEvent) {
  if (!hasWindow()) return [];
  const existing = listSandboxCustomerRescheduleEvents().filter((item) => item.appointment_request_id !== event.appointment_request_id);
  const next = [event, ...existing].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  window.localStorage.setItem(SANDBOX_CUSTOMER_RESCHEDULE_EVENTS_KEY, JSON.stringify(next));
  return next;
}
