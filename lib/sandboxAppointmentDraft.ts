import type { SandboxAnalyzeResult } from "@/lib/sandbox";
import {
  buildSandboxAppointmentIntakeReply,
  getSandboxAppointmentDraftFieldLabel,
  SANDBOX_APPOINTMENT_DRAFT_FIELD_LABELS,
  type SandboxAppointmentDraftField,
} from "@/lib/sandboxAppointmentIntakeForm";
import type { SandboxAppointmentPolicyContext } from "@/lib/sandboxAppointmentPolicy";

export type SandboxAppointmentDraft = {
  service_item: string;
  pet_name: string;
  pet_type_or_breed: string;
  pet_weight: string;
  preferred_date: string;
  preferred_time: string;
  owner_name: string;
  phone: string;
  customer_status: string;
  health_notes: string;
  custom_fields: Record<string, string>;
  missing_fields: string[];
  last_updated_at: string;
};

export type SandboxAppointmentExtracted = SandboxAnalyzeResult["extracted"] & {
  pet_name?: string;
  pet_type_or_breed?: string;
  pet_weight?: string;
  owner_name?: string;
  phone?: string;
  customer_status?: string;
  health_notes?: string;
  custom_fields?: Record<string, string>;
  missing_fields?: string[];
};

export type SandboxAppointmentAnalyzeResult = SandboxAnalyzeResult & {
  extracted: SandboxAppointmentExtracted;
};

export const EMPTY_SANDBOX_APPOINTMENT_DRAFT: SandboxAppointmentDraft = {
  service_item: "",
  pet_name: "",
  pet_type_or_breed: "",
  pet_weight: "",
  preferred_date: "",
  preferred_time: "",
  owner_name: "",
  phone: "",
  customer_status: "",
  health_notes: "",
  custom_fields: {},
  missing_fields: [],
  last_updated_at: "",
};

const COMMITTED_APPOINTMENT_PATTERN =
  /(已(?:經)?(?:為您)?預約|已(?:經)?(?:為您)?預約成功|已幫您保留|已為您保留|已保留|已安排|已為您安排|已幫您安排|已確認預約|預約成功|預約已(?:成立|完成|確認)|已完成預約|(?:我們|門市|這邊)?確認(?:您|你)?預約|(?:今天|明天|後天|到時候).{0,6}見)/;

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

function asStringRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [asCleanString(key), asCleanString(item)] as const)
      .filter(([key, item]) => key && item),
  );
}

export function normalizeSandboxAppointmentExtracted(value: unknown): SandboxAppointmentExtracted {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const normalized: SandboxAppointmentExtracted = {
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
    pet_weight: asCleanString(source.pet_weight),
    owner_name: asCleanString(source.owner_name),
    phone: asCleanString(source.phone),
    customer_status: asCleanString(source.customer_status),
    health_notes: asCleanString(source.health_notes),
    custom_fields: asStringRecord(source.custom_fields),
  };

  if (Object.prototype.hasOwnProperty.call(source, "missing_fields")) {
    normalized.missing_fields = asStringList(source.missing_fields);
  }

  return normalized;
}

export function mergeSandboxAppointmentDraft(
  currentDraft: SandboxAppointmentDraft,
  extracted: Partial<SandboxAppointmentExtracted>,
  nowIso = new Date().toISOString(),
): SandboxAppointmentDraft {
  const nextDraft: SandboxAppointmentDraft = { ...currentDraft, custom_fields: { ...currentDraft.custom_fields } };
  let changed = false;

  const mergeField = (field: SandboxAppointmentDraftField, value: unknown) => {
    const cleanValue = asCleanString(value);
    if (!cleanValue || nextDraft[field] === cleanValue) return;
    nextDraft[field] = cleanValue;
    changed = true;
  };

  mergeField("service_item", extracted.service_item);
  mergeField("pet_name", extracted.pet_name);
  mergeField("pet_type_or_breed", extracted.pet_type_or_breed);
  mergeField("pet_weight", extracted.pet_weight);
  mergeField("preferred_date", extracted.preferred_date);
  mergeField("preferred_time", extracted.preferred_time);
  mergeField("owner_name", extracted.owner_name || extracted.customer_name);
  mergeField("phone", extracted.phone);
  mergeField("customer_status", extracted.customer_status);
  mergeField("health_notes", extracted.health_notes);

  if (extracted.custom_fields) {
    for (const [key, value] of Object.entries(extracted.custom_fields)) {
      const cleanKey = asCleanString(key);
      const cleanValue = asCleanString(value);
      if (!cleanKey || !cleanValue || nextDraft.custom_fields[cleanKey] === cleanValue) continue;
      nextDraft.custom_fields[cleanKey] = cleanValue;
      changed = true;
    }
  }

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
  return (
    SANDBOX_APPOINTMENT_DRAFT_FIELD_LABELS.every(([field]) => !draft[field]) &&
    Object.keys(draft.custom_fields).length === 0 &&
    draft.missing_fields.length === 0
  );
}

export function getSandboxAppointmentDraftRows(draft: SandboxAppointmentDraft): Array<[string, string]> {
  return [
    ...SANDBOX_APPOINTMENT_DRAFT_FIELD_LABELS.map(([field]) => [getSandboxAppointmentDraftFieldLabel(field), draft[field] || "-"] as [string, string]),
    ...Object.entries(draft.custom_fields).map(([label, value]) => [label, value] as [string, string]),
    ["missing_fields", draft.missing_fields.length > 0 ? draft.missing_fields.join("、") : "-"],
    ["last_updated_at", draft.last_updated_at || "-"],
  ];
}

export function buildSandboxAppointmentDraftReply(
  originalReply: string,
  draft: SandboxAppointmentDraft,
  options: {
    needsClarification?: boolean;
    timeStatus?: string;
    policyContext?: SandboxAppointmentPolicyContext;
    previousDraft?: SandboxAppointmentDraft;
  } = {},
) {
  if (options.policyContext) {
    return buildSandboxAppointmentIntakeReply({
      policyContext: options.policyContext,
      draft,
      previousDraft: options.previousDraft,
      timeStatus: options.timeStatus,
    });
  }

  const knownFields = SANDBOX_APPOINTMENT_DRAFT_FIELD_LABELS
    .map(([field, label]) => {
      const value = draft[field];
      return value ? `${label}：${value}` : "";
    })
    .filter(Boolean);
  const customFieldText = Object.entries(draft.custom_fields).map(([label, value]) => `${label}：${value}`);
  const missingText = draft.missing_fields.length > 0 ? `請再補充：${draft.missing_fields.join("、")}。` : "";
  const safetyText = "目前還不是正式預約成功，需由門市人員確認後才算完成。";
  const hasCommittedLanguage = COMMITTED_APPOINTMENT_PATTERN.test(originalReply);

  if (options.timeStatus === "past") {
    return `已收到預約需求，但指定時間似乎已經過去。${knownFields.length + customFieldText.length > 0 ? `目前已整理出：${[...knownFields, ...customFieldText].join("、")}。` : ""}${missingText}${safetyText}`;
  }

  if (hasCommittedLanguage || options.needsClarification === true || draft.missing_fields.length > 0 || knownFields.length > 0) {
    const pendingText = draft.missing_fields.length === 0 ? "資料目前已較完整，會先整理為預約申請。" : "";
    return `已收到預約需求，已整理成預約申請草稿。${knownFields.length + customFieldText.length > 0 ? `目前已知道：${[...knownFields, ...customFieldText].join("、")}。` : ""}${missingText}${pendingText}${safetyText}`;
  }

  return `已收到預約需求，這會先作為預約申請草稿處理。${safetyText}`;
}
