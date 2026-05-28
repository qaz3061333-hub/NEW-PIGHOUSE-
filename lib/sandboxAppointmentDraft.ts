import type { SandboxAnalyzeResult } from "@/lib/sandbox";

export type SandboxAppointmentDraft = {
  service_item: string;
  pet_name: string;
  pet_type_or_breed: string;
  preferred_date: string;
  preferred_time: string;
  owner_name: string;
  phone: string;
  customer_status: string;
  missing_fields: string[];
  last_updated_at: string;
};

export type SandboxAppointmentExtracted = SandboxAnalyzeResult["extracted"] & {
  pet_name?: string;
  pet_type_or_breed?: string;
  owner_name?: string;
  phone?: string;
  customer_status?: string;
  missing_fields?: string[];
};

export type SandboxAppointmentAnalyzeResult = SandboxAnalyzeResult & {
  extracted: SandboxAppointmentExtracted;
};

export const EMPTY_SANDBOX_APPOINTMENT_DRAFT: SandboxAppointmentDraft = {
  service_item: "",
  pet_name: "",
  pet_type_or_breed: "",
  preferred_date: "",
  preferred_time: "",
  owner_name: "",
  phone: "",
  customer_status: "",
  missing_fields: [],
  last_updated_at: "",
};

const DRAFT_FIELD_LABELS: Array<[keyof Omit<SandboxAppointmentDraft, "missing_fields" | "last_updated_at">, string]> = [
  ["service_item", "服務項目"],
  ["pet_name", "寵物姓名"],
  ["pet_type_or_breed", "品種/類型"],
  ["preferred_date", "希望日期"],
  ["preferred_time", "希望時間"],
  ["owner_name", "飼主姓名"],
  ["phone", "聯絡電話"],
  ["customer_status", "新客/舊客"],
];

const COMMITTED_APPOINTMENT_PATTERN =
  /(已(?:經)?(?:為您)?預約成功|已為您預約|已幫您保留|已保留|已安排|已確認預約|預約成功|預約已(?:成立|完成|確認)|已完成預約|(?:我們|門市|這邊)?確認(?:您|你)?預約|明天三點見)/;

function asCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asCleanString(item)).filter(Boolean);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function normalizeSandboxAppointmentExtracted(value: unknown): SandboxAppointmentExtracted {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    customer_name: asCleanString(source.customer_name),
    service_item: asCleanString(source.service_item),
    preferred_date: asCleanString(source.preferred_date),
    preferred_time: asCleanString(source.preferred_time),
    issue: asCleanString(source.issue),
    urgency: asCleanString(source.urgency),
    time_status: source.time_status === "valid" || source.time_status === "past" || source.time_status === "unclear" ? source.time_status : "unclear",
    needs_clarification: source.needs_clarification === true,
    pet_name: asCleanString(source.pet_name),
    pet_type_or_breed: asCleanString(source.pet_type_or_breed),
    owner_name: asCleanString(source.owner_name),
    phone: asCleanString(source.phone),
    customer_status: asCleanString(source.customer_status),
    missing_fields: asStringList(source.missing_fields),
  };
}

export function mergeSandboxAppointmentDraft(
  currentDraft: SandboxAppointmentDraft,
  extracted: Partial<SandboxAppointmentExtracted>,
  nowIso = new Date().toISOString(),
): SandboxAppointmentDraft {
  const nextDraft: SandboxAppointmentDraft = { ...currentDraft };
  let changed = false;

  const mergeField = (field: keyof Omit<SandboxAppointmentDraft, "missing_fields" | "last_updated_at">, value: unknown) => {
    const cleanValue = asCleanString(value);
    if (!cleanValue || nextDraft[field] === cleanValue) return;
    nextDraft[field] = cleanValue;
    changed = true;
  };

  mergeField("service_item", extracted.service_item);
  mergeField("pet_name", extracted.pet_name);
  mergeField("pet_type_or_breed", extracted.pet_type_or_breed);
  mergeField("preferred_date", extracted.preferred_date);
  mergeField("preferred_time", extracted.preferred_time);
  mergeField("owner_name", extracted.owner_name || extracted.customer_name);
  mergeField("phone", extracted.phone);
  mergeField("customer_status", extracted.customer_status);

  if (Array.isArray(extracted.missing_fields)) {
    const nextMissingFields = uniqueStrings(extracted.missing_fields);
    if (nextMissingFields.join("|") !== nextDraft.missing_fields.join("|")) {
      nextDraft.missing_fields = nextMissingFields;
      changed = true;
    }
  }

  if (changed) {
    nextDraft.last_updated_at = nowIso;
  }

  return nextDraft;
}

export function isSandboxAppointmentDraftEmpty(draft: SandboxAppointmentDraft) {
  return DRAFT_FIELD_LABELS.every(([field]) => !draft[field]) && draft.missing_fields.length === 0;
}

export function getSandboxAppointmentDraftRows(draft: SandboxAppointmentDraft): Array<[string, string]> {
  return [
    ...DRAFT_FIELD_LABELS.map(([field, label]) => [field, draft[field] || "-"] as [string, string]),
    ["missing_fields", draft.missing_fields.length > 0 ? draft.missing_fields.join("、") : "-"],
    ["last_updated_at", draft.last_updated_at || "-"],
  ];
}

export function buildSandboxAppointmentDraftReply(
  originalReply: string,
  draft: SandboxAppointmentDraft,
  options: { needsClarification?: boolean; timeStatus?: string } = {},
) {
  const knownFields = DRAFT_FIELD_LABELS
    .map(([field, label]) => {
      const value = draft[field];
      return value ? `${label}：${value}` : "";
    })
    .filter(Boolean);
  const missingText = draft.missing_fields.length > 0 ? `請再補充：${draft.missing_fields.join("、")}。` : "";
  const safetyText = "目前還不是正式預約成功，需由門市人員確認後才算完成。";
  const hasCommittedLanguage = COMMITTED_APPOINTMENT_PATTERN.test(originalReply);

  if (options.timeStatus === "past") {
    return `已收到預約需求，但指定時間似乎已經過去。${knownFields.length > 0 ? `目前已整理出：${knownFields.join("、")}。` : ""}${missingText}${safetyText}`;
  }

  if (hasCommittedLanguage || options.needsClarification === true || draft.missing_fields.length > 0 || knownFields.length > 0) {
    const pendingText = draft.missing_fields.length === 0 ? "資料目前已較完整，可建立 status = pending 的沙盒預約申請。" : "";
    return `已收到預約需求，已整理成預約申請草稿。${knownFields.length > 0 ? `目前已知道：${knownFields.join("、")}。` : ""}${missingText}${pendingText}${safetyText}`;
  }

  return `已收到預約需求，這會先作為預約申請草稿處理。${safetyText}`;
}
