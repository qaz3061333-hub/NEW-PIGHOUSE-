export type SandboxGateDecision = {
  decision:
    | "out_of_scope"
    | "manual_required"
    | "knowledge_candidate"
    | "abnormal_candidate"
    | "appointment_candidate"
    | "allow_ai_analysis";
  reason: string;
  suggested_reply: string;
  should_call_gemini: boolean;
  should_query_knowledge_base: boolean;
  should_create_manual_task: boolean;
};

const OUT_OF_SCOPE_REPLY =
  "這裡是 PIG HOUSE 寵物服務客服，我只能協助寵物美容、住宿、預約與門市服務相關問題。若您有寵物照護或預約需求，我很樂意協助。";

const MANUAL_REPLY =
  "不好意思讓您擔心了，我們會先協助了解狀況並交由人工客服處理。請您先提供寵物姓名、服務日期、目前狀況照片或紅腫位置，方便我們盡快協助。";

function includesAny(input: string, keywords: string[]) {
  return keywords.some((keyword) => input.includes(keyword));
}

export function evaluateSandboxServiceGate(message: string): SandboxGateDecision {
  const normalized = message.trim().toLowerCase();

  const outOfScopeKeywords = [
    "股票", "寫程式", "程式碼", "javascript", "python", "java", "修code", "code review", "感情", "失戀", "聊天", "陪我", "閒聊",
    "醫療診斷", "診斷", "法律", "訴訟", "政治", "宗教", "優惠碼", "折扣碼", "比較別家", "其他店家", "寫作文", "算數學", "產生圖片",
    "畫圖", "ai", "chatgpt", "gemini",
  ];

  const manualKeywords = [
    "真人", "人工", "店長", "主管", "不要機器人", "叫人", "找人", "投訴", "客訴", "我很生氣", "退款", "退費", "價格爭議", "太貴",
    "受傷", "流血", "嚴重紅腫", "紅腫很嚴重", "醫生", "急診", "指名", "指定某員工",
  ];

  const abnormalKeywords = ["紅腫", "過敏", "受傷", "流血", "抓傷", "發炎", "異常", "疼痛", "一直叫", "不舒服"];
  const appointmentKeywords = ["預約", "想約", "改時間", "改約", "明天還有空", "下週", "幾點可以", "有空嗎", "時段", "排時間"];
  const knowledgeKeywords = ["營業時間", "價格", "價位", "多少錢", "付款", "接送", "規範", "服務範圍", "注意事項", "住宿", "洗澡", "修毛", "照護", "流程"];

  if (includesAny(normalized, outOfScopeKeywords)) {
    return {
      decision: "out_of_scope",
      reason: "訊息內容明顯偏離 PIG HOUSE 寵物服務範圍。",
      suggested_reply: OUT_OF_SCOPE_REPLY,
      should_call_gemini: false,
      should_query_knowledge_base: false,
      should_create_manual_task: false,
    };
  }

  if (includesAny(normalized, manualKeywords)) {
    return {
      decision: "manual_required",
      reason: "訊息涉及轉人工、客訴、退款、情緒激動或疑似醫療/傷害風險。",
      suggested_reply: MANUAL_REPLY,
      should_call_gemini: false,
      should_query_knowledge_base: false,
      should_create_manual_task: true,
    };
  }

  if (includesAny(normalized, abnormalKeywords)) {
    return {
      decision: "abnormal_candidate",
      reason: "訊息疑似異常照護或客訴，建議走異常判斷流程。",
      suggested_reply: "我們先協助判斷狀況，必要時會轉人工客服接手。",
      should_call_gemini: true,
      should_query_knowledge_base: true,
      should_create_manual_task: true,
    };
  }

  if (includesAny(normalized, appointmentKeywords)) {
    return {
      decision: "appointment_candidate",
      reason: "訊息包含預約、改約或時段詢問語意。",
      suggested_reply: "收到，我先幫您確認可預約時段與流程。",
      should_call_gemini: true,
      should_query_knowledge_base: false,
      should_create_manual_task: false,
    };
  }

  if (includesAny(normalized, knowledgeKeywords)) {
    return {
      decision: "knowledge_candidate",
      reason: "訊息屬於可由知識庫回答的服務資訊問題。",
      suggested_reply: "我先幫您查詢門市知識庫後回覆。",
      should_call_gemini: true,
      should_query_knowledge_base: true,
      should_create_manual_task: false,
    };
  }

  return {
    decision: "allow_ai_analysis",
    reason: "未命中明確規則，先交由既有沙盒分析流程判斷。",
    suggested_reply: "我先幫您確認需求並安排下一步。",
    should_call_gemini: true,
    should_query_knowledge_base: false,
    should_create_manual_task: false,
  };
}
