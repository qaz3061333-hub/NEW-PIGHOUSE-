"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { conversationLogs as mockConversationLogs } from "@/lib/mockData";
import { EMPTY_ANALYZE_RESULT, SandboxAnalyzeResult } from "@/lib/sandbox";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { ConversationLog } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "customer" | "assistant";
  content: string;
};

const confidencePercent = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isStructuredDateTime(preferredDate: string, preferredTime: string) {
  return DATE_PATTERN.test(preferredDate.trim()) && TIME_PATTERN.test(preferredTime.trim());
}

export default function ConversationLogsPage() {
  const [logs, setLogs] = useState<ConversationLog[]>(mockConversationLogs);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);
  const [inputMessage, setInputMessage] = useState("");
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCreatingSandboxRequest, setIsCreatingSandboxRequest] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SandboxAnalyzeResult | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [sandboxRequestMessage, setSandboxRequestMessage] = useState("");

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) return;
      try {
        const data = await supabaseRequest<ConversationLog[]>({
          table: "messages",
          query: "select=id,channel,content,created_at,customers(name)&order=created_at.desc",
        });

        const mapped: ConversationLog[] = data.map(
          (row: ConversationLog & { content?: string; created_at?: string; customers?: { name?: string } }) => ({
            id: row.id,
            customer: row.customers?.name ?? "未知客戶",
            channel: row.channel,
            last_message: row.content ?? row.last_message,
            updated_at: row.created_at ?? row.updated_at,
          }),
        );

        setLogs(mapped);
      } catch (loadError) {
        setNotice(`Supabase 讀取失敗，已使用 mock data。${(loadError as Error).message}`);
      }
    }

    load();
  }, []);

  const extractedRows = useMemo(() => {
    const data = analysisResult?.extracted ?? EMPTY_ANALYZE_RESULT.extracted;
    return [
      ["customer_name", data.customer_name],
      ["service_item", data.service_item],
      ["preferred_date", data.preferred_date],
      ["preferred_time", data.preferred_time],
      ["issue", data.issue],
      ["urgency", data.urgency],
      ["time_status", data.time_status],
      ["needs_clarification", data.needs_clarification ? "true" : "false"],
    ] as Array<[string, string]>;
  }, [analysisResult]);

  const canCreateSandboxRequest = useMemo(() => {
    if (!analysisResult || analysisResult.intent !== "appointment_request") return false;
    const extracted = analysisResult.extracted;
    if (extracted.needs_clarification || extracted.time_status !== "valid") return false;
    return isStructuredDateTime(extracted.preferred_date, extracted.preferred_time);
  }, [analysisResult]);

  function resolveSandboxRequestedAt(preferredDate: string, preferredTime: string) {
    if (!isStructuredDateTime(preferredDate, preferredTime)) return null;

    const isoCandidate = new Date(`${preferredDate.trim()}T${preferredTime.trim()}:00+08:00`);
    if (Number.isNaN(isoCandidate.getTime())) return null;
    return isoCandidate.toISOString();
  }

  async function submitSandboxMessage(event: FormEvent) {
    event.preventDefault();
    const message = inputMessage.trim();
    if (!message) {
      setError("請先輸入模擬客人訊息。");
      return;
    }

    setIsAnalyzing(true);
    setError("");
    setAnalysisResult(null);
    setSandboxRequestMessage("");

    try {
      const response = await fetch("/api/sandbox/analyze-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const payload = (await response.json()) as { error?: string; result?: SandboxAnalyzeResult };
      if (!response.ok || !payload.result) {
        setError(payload.error || "沙盒分析失敗，請稍後再試。");
        return;
      }

      setAnalysisResult(payload.result);
      setChat([
        { id: `${Date.now()}-customer`, role: "customer", content: message },
        { id: `${Date.now()}-assistant`, role: "assistant", content: payload.result.customer_reply },
      ]);
      setInputMessage("");
    } catch (requestError) {
      setError(`沙盒分析失敗：${(requestError as Error).message}`);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function createSandboxAppointmentRequest() {
    if (!analysisResult || analysisResult.intent !== "appointment_request") return;
    if (!canCreateSandboxRequest) {
      setSandboxRequestMessage("時間需要重新確認，暫不建立沙盒預約。請先修正日期與時間。");
      return;
    }

    setIsCreatingSandboxRequest(true);
    setSandboxRequestMessage("");

    const extracted = analysisResult.extracted;
    const requestedAt = resolveSandboxRequestedAt(extracted.preferred_date, extracted.preferred_time);
    if (!requestedAt) {
      setSandboxRequestMessage("建立失敗：無法解析為有效預約時間，請先修正日期與時間。");
      setIsCreatingSandboxRequest(false);
      return;
    }

    const payload = {
      owner_name: extracted.customer_name?.trim() || "Sandbox Customer",
      service: extracted.service_item?.trim() || "Sandbox Service",
      pet_name: "Sandbox Pet",
      requested_at: requestedAt,
      status: "pending" as const,
      is_sandbox: true,
    };

    if (!isSupabaseConfigured) {
      setSandboxRequestMessage(`建立失敗：${supabaseEnvWarning}`);
      setIsCreatingSandboxRequest(false);
      return;
    }

    try {
      await supabaseRequest({
        table: "appointment_requests",
        method: "POST",
        body: payload,
      });
      setSandboxRequestMessage("已建立沙盒預約申請。請到 Appointment Requests 查看。");
    } catch (createError) {
      setSandboxRequestMessage(`建立失敗：${(createError as Error).message}`);
    } finally {
      setIsCreatingSandboxRequest(false);
    }
  }

  return (
    <PageShell title="Conversation Logs 對話紀錄" description="客服與顧客歷史對話摘要。">
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      <SimpleTable headers={["對話編號", "客戶", "來源", "最後訊息", "更新時間"]}>
        {logs.map((log) => (
          <tr key={log.id}>
            <td className="px-4 py-3">{log.id}</td>
            <td className="px-4 py-3">{log.customer}</td>
            <td className="px-4 py-3">{log.channel}</td>
            <td className="px-4 py-3">{log.last_message}</td>
            <td className="px-4 py-3">{log.updated_at}</td>
          </tr>
        ))}
      </SimpleTable>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">LINE 沙盒對話模擬器（Gemini 沙盒判斷 v1）</h2>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          這是沙盒模擬，不會真的送出 LINE 訊息，也不會通知客人；若建立預約僅會寫入 Sandbox 資料。
        </p>

        <form className="mt-4 space-y-3" onSubmit={submitSandboxMessage}>
          <label className="block text-sm text-slate-700" htmlFor="sandbox-message">
            模擬客人訊息
            <textarea
              id="sandbox-message"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              rows={4}
              placeholder="例如：我想改成下週三晚上七點洗加剪，可以嗎？"
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={isAnalyzing}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isAnalyzing ? "分析中..." : "送出模擬訊息"}
          </button>
        </form>

        {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-800">沙盒聊天視窗</h3>
          <div className="mt-3 space-y-2">
            {chat.length === 0 ? <p className="text-sm text-slate-500">尚未送出模擬訊息。</p> : null}
            {chat.map((message) => (
              <div key={message.id} className={`flex ${message.role === "customer" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    message.role === "customer" ? "bg-emerald-500 text-white" : "bg-white text-slate-800"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {analysisResult ? (
          <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-800">
            <h3 className="font-semibold text-indigo-900">系統判斷結果</h3>
            <ul className="mt-2 space-y-1">
              <li>判斷類型：{analysisResult.intent}</li>
              <li>信心程度：{confidencePercent(analysisResult.confidence)}</li>
              <li>建議歸類功能：{analysisResult.target_module}</li>
              <li>摘要：{analysisResult.summary}</li>
              <li>是否寫入正式資料：否</li>
              <li>是否送出 LINE：否</li>
            </ul>

            <div className="mt-3 rounded border border-indigo-100 bg-white p-3">
              <h4 className="font-medium text-slate-900">擷取欄位</h4>
              <ul className="mt-2 grid gap-1 md:grid-cols-2">
                {extractedRows.map(([key, value]) => (
                  <li key={key}>
                    <span className="font-medium">{key}：</span>
                    <span>{value || "-"}</span>
                  </li>
                ))}
              </ul>
            </div>

            {analysisResult.intent === "appointment_request" ? (
              <div className="mt-3">
                {(!canCreateSandboxRequest || analysisResult.extracted.time_status === "past") && (
                  <p className="mb-2 rounded bg-amber-100 px-3 py-2 text-amber-900">時間需要重新確認，暫不建立沙盒預約。</p>
                )}
                <button
                  type="button"
                  onClick={createSandboxAppointmentRequest}
                  disabled={isCreatingSandboxRequest || !canCreateSandboxRequest}
                  className="rounded bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {isCreatingSandboxRequest ? "建立中..." : "建立沙盒預約申請"}
                </button>
                {sandboxRequestMessage ? <p className="mt-2 text-sm text-slate-700">{sandboxRequestMessage}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
