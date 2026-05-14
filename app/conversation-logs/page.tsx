"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { conversationLogs as mockConversationLogs } from "@/lib/mockData";
import { EMPTY_ANALYZE_RESULT, SandboxAnalyzeResult } from "@/lib/sandbox";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { ConversationLog } from "@/lib/types";
import { clearSandboxConversationEvents, listSandboxConversationEvents, SandboxConversationEvent } from "@/lib/sandboxConversationEvents";
import { appendSandboxCustomerRescheduleEvent } from "@/lib/sandboxCustomerRescheduleEvents";
import { appendSandboxAbnormalAlertEvent } from "@/lib/sandboxAbnormalAlertEvents";
import { clearSandboxAbnormalAlertResolutionEvents, listSandboxAbnormalAlertResolutionEvents, SandboxAbnormalAlertResolutionEvent } from "@/lib/sandboxAbnormalAlertResolutionEvents";
import { normalizeSandboxAlertSeverity } from "@/lib/sandboxAlertSeverity";
import { AppointmentRequest } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "customer" | "assistant";
  content: string;
};

type SandboxHistoryMessage = Pick<ChatMessage, "role" | "content">;
type RescheduleReplyResult = {
  success: boolean;
  action: "accept_new_time" | "unclear" | "decline";
  time_status: "valid" | "unclear" | "past";
  preferred_date: string | null;
  preferred_time: string | null;
  requested_at_iso: string | null;
  staff_note: string;
};

const confidencePercent = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type CustomerRescheduleApiResult = {
  success: boolean;
  action: "request_reschedule" | "unclear" | "not_reschedule";
  time_status: "valid" | "unclear" | "past";
  preferred_date: string | null;
  preferred_time: string | null;
  requested_at_iso: string | null;
  staff_note: string;
};

function formatTaipei(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

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
  const [sandboxAbnormalAlertMessage, setSandboxAbnormalAlertMessage] = useState("");
  const [appointmentSandboxEvents, setAppointmentSandboxEvents] = useState<SandboxConversationEvent[]>([]);
  const [rescheduleReplies, setRescheduleReplies] = useState<Record<string, string>>({});
  const [rescheduleLoading, setRescheduleLoading] = useState<Record<string, boolean>>({});
  const [rescheduleResults, setRescheduleResults] = useState<Record<string, { ok: boolean; message: string; result?: RescheduleReplyResult }>>({});
  const [confirmedSandboxRequests, setConfirmedSandboxRequests] = useState<AppointmentRequest[]>([]);
  const [selectedConfirmedId, setSelectedConfirmedId] = useState("");
  const [customerRescheduleMessage, setCustomerRescheduleMessage] = useState("");
  const [customerRescheduleLoading, setCustomerRescheduleLoading] = useState(false);
  const [customerRescheduleFeedback, setCustomerRescheduleFeedback] = useState<{ ok: boolean; message: string; result?: CustomerRescheduleApiResult } | null>(null);
  const [abnormalResolutionEvents, setAbnormalResolutionEvents] = useState<SandboxAbnormalAlertResolutionEvent[]>([]);

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

  useEffect(() => {
    setAppointmentSandboxEvents(listSandboxConversationEvents().filter((event) => event.source === "appointment_requests"));
    setAbnormalResolutionEvents(listSandboxAbnormalAlertResolutionEvents());
  }, []);


  useEffect(() => {
    async function loadConfirmedSandboxRequests() {
      if (!isSupabaseConfigured) return;
      try {
        const data = await supabaseRequest<AppointmentRequest[]>({
          table: "appointment_requests",
          query: "select=id,owner_name,pet_name,service,requested_at,status,is_sandbox&order=requested_at.desc",
        });
        setConfirmedSandboxRequests(data.filter((item) => item.is_sandbox === true && item.status === "confirmed"));
      } catch {
        setConfirmedSandboxRequests([]);
      }
    }
    loadConfirmedSandboxRequests();
  }, []);

  function handleClearAppointmentSandboxEvents() {
    clearSandboxConversationEvents();
    setAppointmentSandboxEvents([]);
    setRescheduleReplies({});
    setRescheduleLoading({});
    setRescheduleResults({});
  }


  function handleClearAbnormalResolutionEvents() {
    clearSandboxAbnormalAlertResolutionEvents();
    setAbnormalResolutionEvents([]);
  }

  async function handleCustomerRescheduleRequest() {
    const selected = confirmedSandboxRequests.find((item) => item.id === selectedConfirmedId);
    if (!selected) { setCustomerRescheduleFeedback({ ok: false, message: "請先選擇一筆已 confirmed 的 Sandbox 預約。" }); return; }
    const message = customerRescheduleMessage.trim();
    if (!message) { setCustomerRescheduleFeedback({ ok: false, message: "請先輸入模擬客人改約訊息。" }); return; }
    setCustomerRescheduleLoading(true);
    setCustomerRescheduleFeedback(null);
    try {
      const resp = await fetch('/api/sandbox/customer-reschedule-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appointment_request_id:selected.id,current_requested_at:selected.requested_at,customer_message:message,owner_name:selected.owner_name??null,pet_name:selected.pet_name??null,service:selected.service??null})});
      const payload = await resp.json();
      const result = payload.result ? payload.result as CustomerRescheduleApiResult : payload as CustomerRescheduleApiResult;
      if (!resp.ok) throw new Error(payload.error || '分析失敗');
      if (!(result.success && result.requested_at_iso)) { setCustomerRescheduleFeedback({ ok:false, message: result.staff_note || '尚無法更新。', result}); return; }
      const updated = await supabaseRequest<AppointmentRequest[]>({ table:'appointment_requests', method:'PATCH', query:`id=eq.${selected.id}&is_sandbox=eq.true&status=eq.confirmed`, body:{ requested_at: result.requested_at_iso, status:'pending' }, prefer: 'return=representation' });
      if (!updated[0]) {
        setCustomerRescheduleFeedback({ ok:false, message:'未找到可更新的 confirmed Sandbox 預約，可能狀態已變更，請重新整理後再試。', result });
        return;
      }
      appendSandboxCustomerRescheduleEvent({ id:`${selected.id}-${Date.now()}`, appointment_request_id:selected.id, source:'customer_reschedule_request', old_requested_at:selected.requested_at, new_requested_at:result.requested_at_iso, customer_message:message, staff_note:result.staff_note, created_at:new Date().toISOString() });
      setConfirmedSandboxRequests((prev) => prev.filter((item) => item.id !== selected.id));
      setSelectedConfirmedId('');
      setCustomerRescheduleFeedback({ ok:true, message:'已更新原本 Sandbox 預約時間，狀態已改回 pending。這是客人主動改約，不是新預約，請到 Appointment Requests 重新確認。', result});
      setCustomerRescheduleMessage('');
    } catch (e) { setCustomerRescheduleFeedback({ ok:false, message:`更新失敗：${e}` }); }
    finally { setCustomerRescheduleLoading(false); }
  }

  async function handleAnalyzeRescheduleReply(event: SandboxConversationEvent) {
    const customerReply = (rescheduleReplies[event.id] || "").trim();
    if (!customerReply) {
      setRescheduleResults((prev) => ({ ...prev, [event.id]: { ok: false, message: "請先輸入模擬客人回覆。" } }));
      return;
    }

    setRescheduleLoading((prev) => ({ ...prev, [event.id]: true }));
    setRescheduleResults((prev) => ({ ...prev, [event.id]: { ok: false, message: "" } }));

    try {
      const analyzeResponse = await fetch("/api/sandbox/appointment-reschedule-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_request_id: event.appointment_request_id,
          previous_staff_reply: event.content,
          customer_reply: customerReply,
          owner_name: event.owner_name || null,
          pet_name: event.pet_name || null,
          service: event.service || null,
        }),
      });

      const analyzePayload = (await analyzeResponse.json()) as { error?: string; result?: RescheduleReplyResult };
      if (!analyzeResponse.ok || !analyzePayload.result) {
        setRescheduleResults((prev) => ({
          ...prev,
          [event.id]: { ok: false, message: analyzePayload.error || "改約分析失敗，請稍後再試。" },
        }));
        return;
      }

      const result = analyzePayload.result;
      if (!(result.success && result.requested_at_iso)) {
        setRescheduleResults((prev) => ({
          ...prev,
          [event.id]: { ok: false, message: result.staff_note || "尚無法更新預約時間。", result },
        }));
        return;
      }

      if (!isSupabaseConfigured) {
        setRescheduleResults((prev) => ({ ...prev, [event.id]: { ok: false, message: supabaseEnvWarning, result } }));
        return;
      }

      await supabaseRequest({
        table: "appointment_requests",
        method: "PATCH",
        query: `id=eq.${event.appointment_request_id}&is_sandbox=eq.true`,
        body: {
          requested_at: result.requested_at_iso,
          status: "pending",
        },
      });

      setRescheduleResults((prev) => ({
        ...prev,
        [event.id]: {
          ok: true,
          message: "已更新原本 Sandbox 預約時間，狀態已改回 pending。請到 Appointment Requests 做最後確認。",
          result,
        },
      }));
    } catch (updateError) {
      setRescheduleResults((prev) => ({
        ...prev,
        [event.id]: { ok: false, message: `更新失敗：${(updateError as Error).message}` },
      }));
    } finally {
      setRescheduleLoading((prev) => ({ ...prev, [event.id]: false }));
    }
  }

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
    setSandboxAbnormalAlertMessage("");

    const customerMessage: ChatMessage = {
      id: `${Date.now()}-customer`,
      role: "customer",
      content: message,
    };
    const nextHistory: SandboxHistoryMessage[] = [...chat, customerMessage].map(({ role, content }) => ({ role, content }));
    setChat((previous) => [...previous, customerMessage]);

    try {
      const response = await fetch("/api/sandbox/analyze-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: nextHistory }),
      });

      const payload = (await response.json()) as { error?: string; result?: SandboxAnalyzeResult };
      const result = payload.result;
      if (!response.ok || !result) {
        setError(payload.error || "沙盒分析失敗，請稍後再試。");
        return;
      }

      setAnalysisResult(result);
      setChat((previous) => [
        ...previous,
        { id: `${Date.now()}-assistant`, role: "assistant", content: result.customer_reply },
      ]);
      setInputMessage("");
    } catch (requestError) {
      setError(`沙盒分析失敗：${(requestError as Error).message}`);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function clearSandboxConversation() {
    setChat([]);
    setAnalysisResult(null);
    setSandboxRequestMessage("");
    setSandboxAbnormalAlertMessage("");
    setError("");
  }



  function createSandboxAbnormalAlert() {
    if (!analysisResult || analysisResult.intent !== "abnormal_alert") return;

    const extracted = analysisResult.extracted;
    const severity = normalizeSandboxAlertSeverity(extracted.urgency);
    appendSandboxAbnormalAlertEvent({
      id: `sandbox-alert-${Date.now()}`,
      source: "conversation_logs",
      severity,
      title: extracted.issue?.trim() || "Sandbox 異常提醒",
      summary: analysisResult.summary,
      customer_message: inputMessage.trim() || chat.filter((item) => item.role === "customer").at(-1)?.content || "",
      created_at: new Date().toISOString(),
      is_resolved: false,
    });

    setSandboxAbnormalAlertMessage("已建立沙盒異常提醒，請到 Abnormal Alerts 查看。");
    setAbnormalResolutionEvents(listSandboxAbnormalAlertResolutionEvents());
  }

  async function createSandboxAppointmentRequest() {
    if (!analysisResult || analysisResult.intent !== "appointment_request") return;
    if (!canCreateSandboxRequest) {
      setSandboxRequestMessage("時間需要重新確認，暫不建立沙盒預約。請先修正日期與時間。");
      return;
    }

    setIsCreatingSandboxRequest(true);
    setSandboxRequestMessage("");
    setSandboxAbnormalAlertMessage("");

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
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isAnalyzing}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isAnalyzing ? "分析中..." : "送出模擬訊息"}
            </button>
            <button
              type="button"
              onClick={clearSandboxConversation}
              disabled={isAnalyzing || isCreatingSandboxRequest}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              清除沙盒對話
            </button>
          </div>
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

        <div className="mt-5 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-cyan-900">Appointment Requests 沙盒回寫訊息</h3>
            <button
              type="button"
              onClick={handleClearAppointmentSandboxEvents}
              className="rounded border border-cyan-300 bg-white px-3 py-1 text-sm font-medium text-cyan-900 hover:bg-cyan-100"
            >
              清除 Appointment Requests 沙盒回寫
            </button>
          </div>
          <p className="mt-2 text-sm text-cyan-900">
            這些是 Appointment Requests 回寫的 Sandbox 訊息，不會真的送 LINE，也不是正式 messages 資料。
          </p>
          <div className="mt-3 space-y-2">
            {appointmentSandboxEvents.length === 0 ? <p className="text-sm text-slate-500">目前沒有回寫訊息。</p> : null}
            {appointmentSandboxEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-cyan-200 bg-white p-3 text-sm text-slate-800 shadow-sm">
                <p className="text-xs text-slate-500">{event.created_at}｜{event.appointment_status}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {event.owner_name || "-"} / {event.pet_name || "-"} / {event.service || "-"}
                </p>
                <p className="mt-2 rounded-xl bg-cyan-100 px-3 py-2 text-cyan-950">{event.content}</p>
                {event.appointment_status === "proposed_new_time" ? (
                  <div className="mt-3 rounded-md border border-cyan-200 bg-cyan-50 p-3">
                    <label className="block text-sm text-slate-700" htmlFor={`reschedule-reply-${event.id}`}>
                      模擬客人回覆
                      <textarea
                        id={`reschedule-reply-${event.id}`}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        rows={3}
                        placeholder="例如：好，明天下午三點可以"
                        value={rescheduleReplies[event.id] || ""}
                        onChange={(e) => setRescheduleReplies((prev) => ({ ...prev, [event.id]: e.target.value }))}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAnalyzeRescheduleReply(event)}
                      disabled={rescheduleLoading[event.id] === true}
                      className="mt-2 rounded bg-cyan-800 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-400"
                    >
                      {rescheduleLoading[event.id] ? "處理中..." : "分析並更新 Sandbox 預約時間"}
                    </button>
                    {rescheduleResults[event.id]?.message ? (
                      <div
                        className={`mt-2 rounded px-3 py-2 text-sm ${
                          rescheduleResults[event.id].ok ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        <p>{rescheduleResults[event.id].message}</p>
                        {rescheduleResults[event.id].result ? (
                          <ul className="mt-1 list-disc pl-5">
                            <li>preferred_date：{rescheduleResults[event.id].result?.preferred_date || "-"}</li>
                            <li>preferred_time：{rescheduleResults[event.id].result?.preferred_time || "-"}</li>
                            <li>staff_note：{rescheduleResults[event.id].result?.staff_note || "-"}</li>
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-amber-900">Abnormal Alerts 沙盒處理回寫訊息</h3>
            <button
              type="button"
              onClick={handleClearAbnormalResolutionEvents}
              className="rounded border border-amber-300 bg-white px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              清除 Abnormal Alerts 沙盒處理回寫
            </button>
          </div>
          <p className="mt-2 text-sm text-amber-900">
            這些是 Abnormal Alerts 回寫的 Sandbox 訊息，不會真的送 LINE，也不是正式 messages 資料。
          </p>
          <div className="mt-3 space-y-2">
            {abnormalResolutionEvents.length === 0 ? <p className="text-sm text-slate-500">目前沒有回寫訊息。</p> : null}
            {abnormalResolutionEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-amber-200 bg-white p-3 text-sm text-slate-800">
                <p className="text-xs text-slate-500">{event.created_at}</p>
                <p className="mt-1"><span className="font-medium">標題：</span>{event.title}</p>
                <p><span className="font-medium">嚴重度：</span>{event.severity}</p>
                <p><span className="font-medium">原始摘要：</span>{event.summary}</p>
                <p><span className="font-medium">處理備註：</span>{event.resolution_note}</p>
              </div>
            ))}
          </div>
        </div>

        <section className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <h3 className="text-sm font-semibold text-indigo-900">客人主動改已確認預約（Sandbox）</h3>
          <p className="mt-2 text-sm text-indigo-900">
            這是 Sandbox 模擬流程，用來測試客人已預約後主動改時間。不會真的通知客人。
          </p>
          {confirmedSandboxRequests.length === 0 ? (
            <p className="mt-3 text-sm text-slate-700">目前沒有可模擬改約的已確認 Sandbox 預約。</p>
          ) : (
            <>
              <label className="mt-3 block text-sm font-medium text-indigo-900">選擇已確認 Sandbox 預約</label>
              <select
                className="mt-1 w-full rounded border border-indigo-300 bg-white px-2 py-1 text-sm"
                value={selectedConfirmedId}
                onChange={(event) => setSelectedConfirmedId(event.target.value)}
              >
                <option value="">請選擇</option>
                {confirmedSandboxRequests.map((item) => (
                  <option key={item.id} value={item.id}>
                    {`${item.owner_name || "未知飼主"} / ${item.pet_name || "未知寵物"} / ${item.service} / ${formatTaipei(item.requested_at)} / ${item.id}`}
                  </option>
                ))}
              </select>
              <label className="mt-3 block text-sm font-medium text-indigo-900">模擬客人改約訊息</label>
              <textarea
                className="mt-1 min-h-20 w-full rounded border border-indigo-300 bg-white px-2 py-1 text-sm"
                placeholder="例如：抱歉我這個時間突然有事，可以改五點嗎？"
                value={customerRescheduleMessage}
                onChange={(event) => setCustomerRescheduleMessage(event.target.value)}
              />
              <button
                type="button"
                className="mt-3 rounded border border-indigo-300 bg-white px-3 py-1 text-sm font-medium text-indigo-900 disabled:opacity-50"
                disabled={customerRescheduleLoading}
                onClick={handleCustomerRescheduleRequest}
              >
                {customerRescheduleLoading ? "處理中…" : "分析並送出改約請求"}
              </button>
            </>
          )}
          {customerRescheduleFeedback ? (
            <div
              className={`mt-3 rounded border px-3 py-2 text-sm ${
                customerRescheduleFeedback.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"
              }`}
            >
              <p>{customerRescheduleFeedback.message}</p>
              {customerRescheduleFeedback.result ? (
                <ul className="mt-1 list-disc pl-5">
                  <li>preferred_date：{customerRescheduleFeedback.result.preferred_date || "-"}</li>
                  <li>preferred_time：{customerRescheduleFeedback.result.preferred_time || "-"}</li>
                  <li>staff_note：{customerRescheduleFeedback.result.staff_note || "-"}</li>
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

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



            {analysisResult.intent === "abnormal_alert" ? (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">Sandbox 異常提醒（僅 localStorage）</p>
                <p className="mt-1 text-sm text-amber-900">
                  這是 Sandbox 異常提醒，不會通知客人，不會送 LINE，不會寫入正式 messages。
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-800">
                  <li>issue：{analysisResult.extracted.issue || "-"}</li>
                  <li>urgency：{analysisResult.extracted.urgency || "-"}</li>
                  <li>summary：{analysisResult.summary || "-"}</li>
                </ul>
                <button
                  type="button"
                  onClick={createSandboxAbnormalAlert}
                  className="mt-3 rounded bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  建立沙盒異常提醒
                </button>
                {sandboxAbnormalAlertMessage ? <p className="mt-2 text-sm text-slate-700">{sandboxAbnormalAlertMessage}</p> : null}
              </div>
            ) : null}

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
