import { createHmac, timingSafeEqual } from "crypto";

export type LineReplyTextMessageInput = {
  channelAccessToken: string;
  replyToken: string;
  text: string;
  fetchImpl?: typeof fetch;
};

export type LineTextMessageEventContext = {
  replyToken: string;
  userId: string;
  text: string;
};

export type LineTextMessageEventExtraction =
  | {
      ignored: false;
      event: LineTextMessageEventContext;
    }
  | {
      ignored: true;
      reason: "invalid_event" | "non_message_event" | "non_user_source" | "non_text_message";
    };

export function verifyLineSignature(rawBody: string | Buffer, signature: string | null, channelSecret: string) {
  if (!signature || !channelSecret) return false;

  const expectedSignature = createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function extractLineTextMessageEvent(event: unknown): LineTextMessageEventExtraction {
  if (!isRecord(event)) return { ignored: true, reason: "invalid_event" };
  if (event.type !== "message") return { ignored: true, reason: "non_message_event" };

  const source = event.source;
  if (!isRecord(source) || source.type !== "user" || typeof source.userId !== "string") {
    return { ignored: true, reason: "non_user_source" };
  }

  const message = event.message;
  if (!isRecord(message) || message.type !== "text" || typeof message.text !== "string") {
    return { ignored: true, reason: "non_text_message" };
  }

  if (typeof event.replyToken !== "string" || !event.replyToken) {
    return { ignored: true, reason: "invalid_event" };
  }

  return {
    ignored: false,
    event: {
      replyToken: event.replyToken,
      userId: source.userId,
      text: message.text,
    },
  };
}

export async function replyLineTextMessage({
  channelAccessToken,
  replyToken,
  text,
  fetchImpl = fetch,
}: LineReplyTextMessageInput) {
  const response = await fetchImpl("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[LINE] Reply API failed", {
      status: response.status,
      body,
    });
  }

  return {
    ok: response.ok,
    status: response.status,
  };
}
