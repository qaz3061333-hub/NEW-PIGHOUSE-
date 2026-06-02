export const SANDBOX_APPOINTMENT_AVAILABILITY_COMPLETE_REPLY =
  "收到，我已幫您轉給門市確認空檔。這還不是正式預約成功，稍後會由同事回覆您。";

const SANDBOX_APPOINTMENT_AVAILABILITY_MISSING_REPLY_PREFIX =
  "收到，我先幫您轉給門市確認空檔。這還不是正式預約成功。請先補充：";

export function buildSandboxAppointmentAvailabilityReply(missingDetails: string[]) {
  const cleanedMissingDetails = missingDetails.map((detail) => detail.trim()).filter(Boolean);
  if (cleanedMissingDetails.length === 0) return SANDBOX_APPOINTMENT_AVAILABILITY_COMPLETE_REPLY;
  return `${SANDBOX_APPOINTMENT_AVAILABILITY_MISSING_REPLY_PREFIX}${cleanedMissingDetails.join("、")}。`;
}
