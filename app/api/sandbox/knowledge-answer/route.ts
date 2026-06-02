import { NextResponse } from "next/server";
import {
  runSandboxKnowledgeAnswer,
  SandboxKnowledgeAnswerError,
  type SandboxKnowledgeAnswerRequest,
} from "@/lib/sandboxKnowledgeAnswer";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SandboxKnowledgeAnswerRequest;
    const answer = await runSandboxKnowledgeAnswer(body);
    return NextResponse.json(answer);
  } catch (error) {
    if (error instanceof SandboxKnowledgeAnswerError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: `知識庫沙盒查詢失敗：${(error as Error).message}` }, { status: 500 });
  }
}
