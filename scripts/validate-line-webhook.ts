import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  extractLineTextMessageEvent,
  verifyLineSignature,
} from "../lib/lineMessaging";
import {
  buildSandboxLineCustomerServiceReply,
  type SandboxKnowledgeAnswerRunner,
} from "../lib/sandboxLineCustomerService";
import { SANDBOX_APPOINTMENT_AVAILABILITY_COMPLETE_REPLY } from "../lib/sandboxAppointmentAvailabilityReply";
import { POST as lineWebhookPOST } from "../app/api/line/webhook/route";

const mockKnowledgeAnswerRunner: SandboxKnowledgeAnswerRunner = async (request) => ({
  answer: String(request.message || "").includes("住宿")
    ? "住宿用品請依 Knowledge Base 準備，若有特殊狀況會再由門市確認。"
    : "請問寶貝目前大約幾公斤呢？這項服務會依體重區間報價，我先確認體重後再幫您估區間。",
  matched_articles: [
    {
      id: "kb-test-1",
      title: "測試 Knowledge Base",
      category: "validation",
      score: 1,
    },
  ],
  needs_manual_reply: false,
  used_knowledge_base: true,
  knowledge_fallback_reason: "",
});

function signBody(rawBody: string, channelSecret: string) {
  return createHmac("sha256", channelSecret).update(rawBody).digest("base64");
}

function assertNotIncludes(value: string, banned: string[]) {
  for (const keyword of banned) {
    assert.equal(value.includes(keyword), false, `reply must not include ${keyword}: ${value}`);
  }
}

function buildLineWebhookRequest(events: unknown[], channelSecret: string) {
  const rawBody = JSON.stringify({ events });
  return new Request("http://localhost/api/line/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-line-signature": signBody(rawBody, channelSecret),
    },
    body: rawBody,
  });
}

async function assertWebhookReplyCounts(replyApiStatus: number, expected: { processed: number; failed_count: number }) {
  const oldSecret = process.env.LINE_CHANNEL_SECRET;
  const oldToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const originalFetch = globalThis.fetch;
  const channelSecret = "line-secret-for-validation";
  let replyApiCalls = 0;

  process.env.LINE_CHANNEL_SECRET = channelSecret;
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "line-access-token-for-validation";
  globalThis.fetch = (async () => {
    replyApiCalls += 1;
    return new Response(replyApiStatus >= 200 && replyApiStatus < 300 ? "{}" : "mock LINE reply failure", {
      status: replyApiStatus,
    });
  }) as typeof fetch;

  try {
    const response = await lineWebhookPOST(
      buildLineWebhookRequest(
        [
          {
            type: "message",
            replyToken: "reply-token",
            source: { type: "user", userId: "U123" },
            message: { type: "text", text: "明天3點可以洗澡嗎？" },
          },
        ],
        channelSecret,
      ),
    );
    assert.equal(response.status, 200);
    const payload = (await response.json()) as { processed: number; ignored_count: number; failed_count: number };
    assert.equal(replyApiCalls, 1);
    assert.equal(payload.processed, expected.processed, `processed count mismatch for status ${replyApiStatus}`);
    assert.equal(payload.ignored_count, 0);
    assert.equal(payload.failed_count, expected.failed_count, `failed_count mismatch for status ${replyApiStatus}`);
  } finally {
    if (oldSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
    else process.env.LINE_CHANNEL_SECRET = oldSecret;
    if (oldToken === undefined) delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    else process.env.LINE_CHANNEL_ACCESS_TOKEN = oldToken;
    globalThis.fetch = originalFetch;
  }
}

async function main() {
  const channelSecret = "line-secret-for-validation";
  const rawBody = JSON.stringify({ events: [] });
  const signature = signBody(rawBody, channelSecret);

  assert.equal(verifyLineSignature(rawBody, signature, channelSecret), true, "signature should pass");
  assert.equal(verifyLineSignature(rawBody, "bad-signature", channelSecret), false, "signature should fail");

  const textEvent = {
    type: "message",
    replyToken: "reply-token",
    source: { type: "user", userId: "U123" },
    message: { type: "text", text: "明天3點可以洗澡嗎？" },
  };
  const extracted = extractLineTextMessageEvent(textEvent);
  if (extracted.ignored) throw new Error(`text event should not be ignored: ${extracted.reason}`);
  assert.equal(extracted.event.text, "明天3點可以洗澡嗎？");
  assert.equal(extracted.event.replyToken, "reply-token");
  assert.equal(extracted.event.userId, "U123");

  const stickerEvent = {
    ...textEvent,
    message: { type: "sticker", packageId: "1", stickerId: "1" },
  };
  assert.equal(extractLineTextMessageEvent(stickerEvent).ignored, true, "non-text message should be ignored");

  const groupEvent = {
    ...textEvent,
    source: { type: "group", groupId: "C123", userId: "U123" },
  };
  assert.equal(extractLineTextMessageEvent(groupEvent).ignored, true, "group message should be ignored");

  const appointmentMissing = await buildSandboxLineCustomerServiceReply({
    message: "明天3點可以洗澡嗎？",
    knowledgeAnswerRunner: mockKnowledgeAnswerRunner,
  });
  assert.equal(appointmentMissing.manualTaskType, "appointment_availability");
  assertNotIncludes(appointmentMissing.replyText, ["可以", "有空", "已預約"]);

  const appointmentComplete = await buildSandboxLineCustomerServiceReply({
    message: "小寶 馬爾濟斯 0912345678 預約明天三點洗澡",
    knowledgeAnswerRunner: mockKnowledgeAnswerRunner,
  });
  assert.equal(appointmentComplete.replyText, SANDBOX_APPOINTMENT_AVAILABILITY_COMPLETE_REPLY);

  const missingQuoteInfo = await buildSandboxLineCustomerServiceReply({
    message: "馬爾濟斯洗澡多少？",
    knowledgeAnswerRunner: mockKnowledgeAnswerRunner,
  });
  assert.equal(missingQuoteInfo.replyKind, "kb_auto_reply");
  assert.equal(missingQuoteInfo.replyText.includes("幾公斤"), true);

  const quoteWithDate = await buildSandboxLineCustomerServiceReply({
    message: "明天洗澡多少錢？",
    knowledgeAnswerRunner: mockKnowledgeAnswerRunner,
  });
  assert.equal(quoteWithDate.triageDecision.should_query_knowledge_base, true);
  assert.notEqual(quoteWithDate.manualTaskType, "appointment_availability");

  const complaintRefund = await buildSandboxLineCustomerServiceReply({
    message: "上次洗完很差，可以退費嗎？",
    knowledgeAnswerRunner: mockKnowledgeAnswerRunner,
  });
  assert.equal(complaintRefund.manualTaskType, "complaint_refund");
  assertNotIncludes(complaintRefund.replyText, ["承諾退款", "會退款", "可以退款"]);

  const highRisk = await buildSandboxLineCustomerServiceReply({
    message: "狗狗耳朵流膿可以幫我清嗎？",
    knowledgeAnswerRunner: mockKnowledgeAnswerRunner,
  });
  assert.equal(highRisk.manualTaskType, "high_risk");
  assert.equal(highRisk.replyText.includes("獸醫"), true);
  assertNotIncludes(highRisk.replyText, ["可以幫您清", "可以清"]);

  await assertWebhookReplyCounts(200, { processed: 1, failed_count: 0 });
  await assertWebhookReplyCounts(400, { processed: 0, failed_count: 1 });
  await assertWebhookReplyCounts(401, { processed: 0, failed_count: 1 });
  await assertWebhookReplyCounts(429, { processed: 0, failed_count: 1 });

  console.log("LINE webhook helper validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
