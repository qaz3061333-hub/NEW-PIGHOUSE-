export type SandboxArchiveEligibility = "eligible" | "not_eligible" | "needs_review";

export type SandboxArchiveEventType =
  | "manual_reply_task"
  | "abnormal_alert"
  | "appointment_request"
  | "knowledge_gap"
  | "conversation";

export type SandboxArchivePolicyInput = {
  eventType: SandboxArchiveEventType;
  status?: string | null;
  isResolved?: boolean;
  isReplied?: boolean;
  isArchived?: boolean;
  isIgnored?: boolean;
  hasResolutionNote?: boolean;
  isHighRisk?: boolean;
  ageHours?: number;
};

export type SandboxArchivePolicyDecision = {
  eligibility: SandboxArchiveEligibility;
  label: string;
  reason: string;
  future_archive_behavior: string;
  must_keep_audit_log: boolean;
  can_delete_after_archive: boolean;
};

const SAFE_ARCHIVE_BEHAVIOR =
  "未來可由每日排程封存，但不應物理刪除，只應標記 archived。";

const HOLD_BEHAVIOR =
  "目前應保留在工作清單或稽核檢視中，直到完成處理條件後再重新評估封存。";

const REVIEW_BEHAVIOR =
  "未來可列入封存候選清單，但必須先由人工複查，確認沒有客訴、受傷、退款、醫療風險或後續追蹤。";

function eligible(reason: string, label = "可封存候選"): SandboxArchivePolicyDecision {
  return {
    eligibility: "eligible",
    label,
    reason,
    future_archive_behavior: SAFE_ARCHIVE_BEHAVIOR,
    must_keep_audit_log: true,
    can_delete_after_archive: false,
  };
}

function notEligible(label: string, reason: string): SandboxArchivePolicyDecision {
  return {
    eligibility: "not_eligible",
    label,
    reason,
    future_archive_behavior: HOLD_BEHAVIOR,
    must_keep_audit_log: true,
    can_delete_after_archive: false,
  };
}

function needsReview(label: string, reason: string): SandboxArchivePolicyDecision {
  return {
    eligibility: "needs_review",
    label,
    reason,
    future_archive_behavior: REVIEW_BEHAVIOR,
    must_keep_audit_log: true,
    can_delete_after_archive: false,
  };
}

export function evaluateSandboxArchivePolicy(
  input: SandboxArchivePolicyInput,
): SandboxArchivePolicyDecision {
  const status = input.status?.toLowerCase() || "";
  const ageHours = input.ageHours ?? 0;

  if (input.isArchived) {
    return notEligible(
      "已封存，不需重複封存",
      "此事件已標記 archived；沙盒預覽不會再執行任何封存或刪除動作。",
    );
  }

  switch (input.eventType) {
    case "manual_reply_task": {
      if (!input.isReplied) {
        return notEligible("尚未處理，不可封存", "Manual Reply Task 尚未回覆，仍需保留在人工處理清單。");
      }
      if (!input.hasResolutionNote) {
        return notEligible("缺少處理備註，不可封存", "已回覆但缺少處理備註或 resolution note，未來追查脈絡不足。");
      }
      if (ageHours < 24) {
        return notEligible("仍在保護時間內，不可封存", "已回覆且有處理備註，但尚未超過 24 小時保護時間。");
      }
      return eligible("Manual Reply Task 已回覆、有處理備註，且已超過 24 小時保護時間。");
    }
    case "abnormal_alert":
      return needsReview(
        "異常事件需人工複查後封存",
        "異常事件可能涉及客訴、受傷、醫療風險或後續追蹤，不應只因標記已處理就自動封存。",
      );
    case "appointment_request": {
      if (status === "pending") {
        return notEligible("仍待確認，不可封存", "Appointment Request 仍是 pending，尚未完成最後確認或拒絕。");
      }
      if (["confirmed", "rejected", "completed"].includes(status) && ageHours >= 24) {
        return eligible("Appointment Request 已進入 confirmed / rejected / completed，且已超過 24 小時保護時間。");
      }
      return notEligible("尚未達封存條件，不可封存", "Appointment Request 尚未完成，或尚未超過 24 小時保護時間。");
    }
    case "knowledge_gap": {
      if (status === "open") {
        return notEligible("仍待補充，不可封存", "Knowledge Gap 仍是 open，代表知識庫內容尚未補齊或確認。");
      }
      if (status === "added" || status === "ignored" || input.isIgnored) {
        return eligible("Knowledge Gap 已標記 added 或 ignored，可作為未來封存候選。");
      }
      return notEligible("尚未達封存條件，不可封存", "Knowledge Gap 狀態尚未明確完成或忽略。");
    }
    case "conversation":
      return needsReview(
        "對話紀錄需保留稽核，不建議自動刪除",
        "Conversation Logs 可能是後續追查、客訴釐清、人工處理與模型行為檢查的依據，不應自動刪除。",
      );
  }
}
