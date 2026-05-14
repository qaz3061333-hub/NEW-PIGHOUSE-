export type SandboxKnowledgeGapEvent = {
  id: string;
  normalized_question: string;
  representative_message: string;
  suggested_title: string;
  suggested_category: string;
  reason: string;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: "open" | "added" | "ignored";
};

const STORAGE_KEY = "new_pighouse_sandbox_knowledge_gap_events_v1";

type KnowledgeGapInput = Omit<
  SandboxKnowledgeGapEvent,
  "id" | "normalized_question" | "count" | "first_seen_at" | "last_seen_at" | "status"
> & { normalized_question?: string };

export function normalizeKnowledgeGapQuestion(message: string) {
  return message
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .slice(0, 60);
}

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function listSandboxKnowledgeGapEvents(): SandboxKnowledgeGapEvent[] {
  const storage = getStorage();
  if (!storage) return [];
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SandboxKnowledgeGapEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(events: SandboxKnowledgeGapEvent[]) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export function upsertSandboxKnowledgeGapEvent(eventInput: KnowledgeGapInput) {
  const events = listSandboxKnowledgeGapEvents();
  const normalizedQuestion = eventInput.normalized_question || normalizeKnowledgeGapQuestion(eventInput.representative_message);
  const now = new Date().toISOString();
  const existing = events.find((item) => item.normalized_question === normalizedQuestion);

  if (existing) {
    const updated = events.map((item) =>
      item.id === existing.id
        ? {
            ...item,
            representative_message: eventInput.representative_message,
            suggested_title: eventInput.suggested_title,
            suggested_category: eventInput.suggested_category,
            reason: eventInput.reason,
            count: item.count + 1,
            last_seen_at: now,
          }
        : item,
    );
    save(updated);
    return;
  }

  const created: SandboxKnowledgeGapEvent = {
    id: `sandbox-knowledge-gap-${Date.now()}`,
    normalized_question: normalizedQuestion,
    representative_message: eventInput.representative_message,
    suggested_title: eventInput.suggested_title,
    suggested_category: eventInput.suggested_category,
    reason: eventInput.reason,
    count: 1,
    first_seen_at: now,
    last_seen_at: now,
    status: "open",
  };

  save([created, ...events]);
}

export function markSandboxKnowledgeGapEventAdded(id: string) {
  save(listSandboxKnowledgeGapEvents().map((item) => (item.id === id ? { ...item, status: "added" } : item)));
}

export function markSandboxKnowledgeGapEventIgnored(id: string) {
  save(listSandboxKnowledgeGapEvents().map((item) => (item.id === id ? { ...item, status: "ignored" } : item)));
}

export function clearSandboxKnowledgeGapEvents() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(STORAGE_KEY);
}
