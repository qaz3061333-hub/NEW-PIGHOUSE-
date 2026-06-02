import { NextResponse } from "next/server";
import {
  extractLineTextMessageEvent,
  replyLineTextMessage,
  verifyLineSignature,
} from "@/lib/lineMessaging";
import {
  buildSandboxLineCustomerServiceReply,
  summarizeSandboxLineReplyForLog,
} from "@/lib/sandboxLineCustomerService";

export const runtime = "nodejs";

type LineWebhookPayload = {
  events?: unknown[];
};

function getLineEnv() {
  const channelSecret = process.env.LINE_CHANNEL_SECRET?.trim();
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();

  if (!channelSecret || !channelAccessToken) {
    console.error("[LINE webhook] Missing LINE_CHANNEL_SECRET or LINE_CHANNEL_ACCESS_TOKEN");
    return null;
  }

  return { channelSecret, channelAccessToken };
}

export async function POST(request: Request) {
  const lineEnv = getLineEnv();
  if (!lineEnv) {
    return NextResponse.json({ ok: false, error: "LINE env is not configured" }, { status: 500 });
  }

  const rawBodyBuffer = Buffer.from(await request.arrayBuffer());
  const rawBody = rawBodyBuffer.toString("utf8");
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBodyBuffer, signature, lineEnv.channelSecret)) {
    return NextResponse.json({ ok: false, error: "Invalid LINE signature" }, { status: 401 });
  }

  let payload: LineWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as LineWebhookPayload;
  } catch (error) {
    console.error("[LINE webhook] Invalid JSON payload", { error: (error as Error).message });
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];
  let processed = 0;
  let ignored = 0;

  for (const event of events) {
    const extraction = extractLineTextMessageEvent(event);
    if (extraction.ignored) {
      ignored += 1;
      console.log("[LINE webhook] Ignored event", { reason: extraction.reason });
      continue;
    }

    try {
      const reply = await buildSandboxLineCustomerServiceReply({
        message: extraction.event.text,
        history: [{ role: "customer", content: extraction.event.text }],
      });

      console.log("[LINE webhook] Sandbox triage result", {
        userId: extraction.event.userId,
        ...summarizeSandboxLineReplyForLog(reply),
      });

      await replyLineTextMessage({
        channelAccessToken: lineEnv.channelAccessToken,
        replyToken: extraction.event.replyToken,
        text: reply.replyText,
      });

      processed += 1;
    } catch (error) {
      console.error("[LINE webhook] Failed to process text message event", {
        userId: extraction.event.userId,
        error: (error as Error).message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    ignored: processed === 0,
    processed,
    ignored_count: ignored,
  });
}
