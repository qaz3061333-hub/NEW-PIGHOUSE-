export type SandboxAlertSeverity = "low" | "medium" | "high";

export function normalizeSandboxAlertSeverity(value: string | null | undefined): SandboxAlertSeverity {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "medium";

  if (["high", "urgent", "緊急", "高", "高風險"].includes(normalized)) return "high";
  if (["medium", "normal", "中", "中等", "一般"].includes(normalized)) return "medium";
  if (["low", "低", "低風險"].includes(normalized)) return "low";

  return "medium";
}
