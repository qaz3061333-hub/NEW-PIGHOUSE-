export const SANDBOX_INTENTS = [
  "appointment_request",
  "abnormal_alert",
  "knowledge_question",
  "manual_reply_task",
  "unknown",
] as const;

export type SandboxIntent = (typeof SANDBOX_INTENTS)[number];

export type SandboxTimeStatus = "valid" | "past" | "unclear";

export type SandboxAnalyzeResult = {
  intent: SandboxIntent;
  confidence: number;
  customer_reply: string;
  target_module: "Appointment Requests" | "Abnormal Alerts" | "Knowledge Base" | "Manual Reply Tasks" | "Conversation Logs";
  summary: string;
  extracted: {
    customer_name: string;
    service_item: string;
    preferred_date: string;
    preferred_time: string;
    issue: string;
    urgency: string;
    time_status: SandboxTimeStatus;
    needs_clarification: boolean;
  };
};

export const EMPTY_ANALYZE_RESULT: SandboxAnalyzeResult = {
  intent: "unknown",
  confidence: 0,
  customer_reply: "目前無法判斷您的需求，將轉由人工客服協助確認。",
  target_module: "Conversation Logs",
  summary: "尚未提供可判斷的內容。",
  extracted: {
    customer_name: "",
    service_item: "",
    preferred_date: "",
    preferred_time: "",
    issue: "",
    urgency: "",
    time_status: "unclear",
    needs_clarification: true,
  },
};
