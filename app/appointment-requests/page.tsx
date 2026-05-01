"use client";

import { Fragment, useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { appointmentRequests as mockAppointmentRequests } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { AppointmentRequest, AppointmentStatus } from "@/lib/types";
import { appendSandboxConversationEvent } from "@/lib/sandboxConversationEvents";

const statusOptions: AppointmentStatus[] = ["pending", "confirmed", "proposed_new_time", "rejected"];

function fallbackSplitRequestedAt(requestedAt: string): { dateText: string; timeText: string } {
  const trimmed = requestedAt.trim();
  if (!trimmed) {
    return { dateText: "未提供日期", timeText: "未提供時間" };
  }

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (match) {
    return { dateText: match[1], timeText: match[2] };
  }

  const [datePart, timePart] = trimmed.split(/\s+/, 2);
  return {
    dateText: datePart || "未提供日期",
    timeText: timePart || "未提供時間",
  };
}

function formatRequestedAtForTaipei(requestedAt: string): { dateText: string; timeText: string } {
  const parsed = new Date(requestedAt);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackSplitRequestedAt(requestedAt);
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(parsed);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");

  if (!year || !month || !day || !hour || !minute) {
    return fallbackSplitRequestedAt(requestedAt);
  }

  return {
    dateText: `${year}-${month}-${day}`,
    timeText: `${hour}:${minute}`,
  };
}

function buildSandboxConfirmedMessage(request: AppointmentRequest): string {
  const { dateText, timeText } = formatRequestedAtForTaipei(request.requested_at);
  const ownerName = request.owner_name?.trim();
  const petName = request.pet_name?.trim();
  const namePrefix = [ownerName, petName ? `（${petName}）` : ""].filter(Boolean).join("");
  const greeting = namePrefix ? `${namePrefix}您好，` : "您好，";

  return `${greeting}已確認您的預約：${dateText} ${timeText}，服務項目：${request.service}。這是 Sandbox 模擬確認訊息，不會真的通知客人。`;
}

type SandboxProposedNewTimeResult = {
  success: boolean;
  time_status: "valid" | "unclear" | "past";
  interpreted_time: string | null;
  customer_reply: string | null;
  needs_clarification: boolean;
  staff_note: string;
};

type SandboxRejectedReplyResult = {
  success: boolean;
  customer_reply: string | null;
  needs_clarification: boolean;
  staff_note: string;
};

export default function AppointmentRequestsPage() {
  const [requests, setRequests] = useState<AppointmentRequest[]>(mockAppointmentRequests);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);
  const [actionMessage, setActionMessage] = useState<string>("");
  const [actionMessageType, setActionMessageType] = useState<"success" | "error">("success");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sandboxStaffNotes, setSandboxStaffNotes] = useState<Record<string, string>>({});
  const [sandboxGeminiLoading, setSandboxGeminiLoading] = useState<Record<string, boolean>>({});
  const [sandboxGeminiErrors, setSandboxGeminiErrors] = useState<Record<string, string>>({});
  const [sandboxGeminiResults, setSandboxGeminiResults] = useState<Record<string, SandboxProposedNewTimeResult | null>>({});
  const [sandboxGeminiConfirmations, setSandboxGeminiConfirmations] = useState<Record<string, boolean>>({});
  const [sandboxRejectedNotes, setSandboxRejectedNotes] = useState<Record<string, string>>({});
  const [sandboxRejectedLoading, setSandboxRejectedLoading] = useState<Record<string, boolean>>({});
  const [sandboxRejectedErrors, setSandboxRejectedErrors] = useState<Record<string, string>>({});
  const [sandboxRejectedResults, setSandboxRejectedResults] = useState<Record<string, SandboxRejectedReplyResult | null>>({});
  const [sandboxRejectedConfirmations, setSandboxRejectedConfirmations] = useState<Record<string, boolean>>({});
  const [sandboxConversationWritebacks, setSandboxConversationWritebacks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) return;
      try {
        const data = await supabaseRequest<AppointmentRequest[]>({
          table: "appointment_requests",
          query: "select=*&order=requested_at.desc",
        });
        setRequests(data.map((item) => ({ ...item, is_sandbox: item.is_sandbox ?? false })));
        setNotice("");
      } catch (error) {
        setNotice(`Supabase 讀取失敗，已使用 mock data。${(error as Error).message}`);
      }
    }

    load();
  }, []);

  async function updateStatus(id: string, status: AppointmentStatus) {
    if (status !== "proposed_new_time") {
      setSandboxStaffNotes((prev) => ({ ...prev, [id]: "" }));
      setSandboxGeminiErrors((prev) => ({ ...prev, [id]: "" }));
      setSandboxGeminiResults((prev) => ({ ...prev, [id]: null }));
      setSandboxGeminiConfirmations((prev) => ({ ...prev, [id]: false }));
    }
    if (status !== "rejected") {
      setSandboxRejectedNotes((prev) => ({ ...prev, [id]: "" }));
      setSandboxRejectedErrors((prev) => ({ ...prev, [id]: "" }));
      setSandboxRejectedResults((prev) => ({ ...prev, [id]: null }));
      setSandboxRejectedConfirmations((prev) => ({ ...prev, [id]: false }));
    }
    setSandboxConversationWritebacks((prev) => ({
      ...prev,
      [`${id}:confirmed`]: false,
      [`${id}:proposed_new_time`]: false,
      [`${id}:rejected`]: false,
    }));

    if (!isSupabaseConfigured) {
      setRequests((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
      setNotice(supabaseEnvWarning);
      return;
    }

    try {
      const updated = await supabaseRequest<AppointmentRequest[]>({
        table: "appointment_requests",
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(id)}`,
        body: { status, updated_at: new Date().toISOString() },
        prefer: "return=representation",
      });
      if (!updated[0]) {
        setNotice("狀態更新失敗：找不到對應資料列。");
        return;
      }
      const normalized = { ...updated[0], is_sandbox: updated[0].is_sandbox ?? false };
      setRequests((prev) => prev.map((item) => (item.id === id ? normalized : item)));
      setNotice("");
    } catch (error) {
      setNotice(`狀態更新失敗：${(error as Error).message}`);
    }
  }

  async function deleteRequest(request: AppointmentRequest) {
    const isSandbox = request.is_sandbox ?? false;
    const confirmMessage = isSandbox
      ? "這是 Sandbox 測試資料。確定要刪除此預約嗎？此操作無法復原。"
      : "確定要刪除此預約嗎？此操作無法復原。";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    if (!isSupabaseConfigured) {
      setRequests((prev) => prev.filter((item) => item.id !== request.id));
      setExpandedId((prev) => (prev === request.id ? null : prev));
      setActionMessage(`已刪除預約 ${request.id}（mock data）。`);
      setActionMessageType("success");
      setNotice(supabaseEnvWarning);
      return;
    }

    try {
      const deleted = await supabaseRequest<AppointmentRequest[]>({
        table: "appointment_requests",
        method: "DELETE",
        query: `id=eq.${encodeURIComponent(request.id)}`,
      });

      if (!deleted[0]) {
        setActionMessage(`刪除失敗：找不到預約 ${request.id}。`);
        setActionMessageType("error");
        return;
      }

      setRequests((prev) => prev.filter((item) => item.id !== request.id));
      setExpandedId((prev) => (prev === request.id ? null : prev));
      setActionMessage(`已成功刪除預約 ${request.id}。`);
      setActionMessageType("success");
    } catch (error) {
      setActionMessage(`刪除失敗：${(error as Error).message}`);
      setActionMessageType("error");
    }
  }

  async function generateSandboxProposedNewTimeWithGemini(request: AppointmentRequest) {
    const staffNote = (sandboxStaffNotes[request.id] ?? "").trim();
    if (!staffNote) return;

    setSandboxGeminiLoading((prev) => ({ ...prev, [request.id]: true }));
    setSandboxGeminiErrors((prev) => ({ ...prev, [request.id]: "" }));

    try {
      const response = await fetch("/api/sandbox/proposed-new-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: request.id,
          staff_note: staffNote,
          service: request.service,
          owner_name: request.owner_name,
          pet_name: request.pet_name,
          requested_at: request.requested_at,
          is_sandbox: request.is_sandbox ?? false,
          status: request.status,
        }),
      });

      const payload = (await response.json()) as { result?: SandboxProposedNewTimeResult; error?: string };

      if (!response.ok || !payload.result) {
        const fallbackMessage = "Gemini 沙盒轉換失敗，請稍後再試。";
        throw new Error(payload.error?.trim() || fallbackMessage);
      }

      setSandboxGeminiResults((prev) => ({ ...prev, [request.id]: payload.result! }));
    } catch (error) {
      setSandboxGeminiResults((prev) => ({ ...prev, [request.id]: null }));
      setSandboxGeminiErrors((prev) => ({ ...prev, [request.id]: (error as Error).message }));
    } finally {
      setSandboxGeminiLoading((prev) => ({ ...prev, [request.id]: false }));
    }
  }


  function appendAppointmentSandboxEvent(request: AppointmentRequest, status: "confirmed" | "proposed_new_time" | "rejected", content: string) {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    appendSandboxConversationEvent({
      id: `${request.id}-${status}`,
      source: "appointment_requests",
      appointment_request_id: request.id,
      appointment_status: status,
      role: "assistant",
      content: trimmedContent,
      owner_name: request.owner_name,
      pet_name: request.pet_name,
      service: request.service,
      created_at: new Date().toISOString(),
    });

    setSandboxConversationWritebacks((prev) => ({ ...prev, [`${request.id}:${status}`]: true }));
  }

  async function generateSandboxRejectedReplyWithGemini(request: AppointmentRequest) {
    const rejectionNote = (sandboxRejectedNotes[request.id] ?? "").trim();
    if (!rejectionNote) return;

    setSandboxRejectedLoading((prev) => ({ ...prev, [request.id]: true }));
    setSandboxRejectedErrors((prev) => ({ ...prev, [request.id]: "" }));

    try {
      const response = await fetch("/api/sandbox/rejected-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: request.id,
          rejection_note: rejectionNote,
          service: request.service,
          owner_name: request.owner_name,
          pet_name: request.pet_name,
          requested_at: request.requested_at,
          is_sandbox: request.is_sandbox ?? false,
          status: request.status,
        }),
      });

      const payload = (await response.json()) as { result?: SandboxRejectedReplyResult; error?: string };
      if (!response.ok || !payload.result) {
        const fallbackMessage = "Gemini 沙盒拒絕回覆失敗，請稍後再試。";
        throw new Error(payload.error?.trim() || fallbackMessage);
      }

      setSandboxRejectedResults((prev) => ({ ...prev, [request.id]: payload.result! }));
    } catch (error) {
      setSandboxRejectedResults((prev) => ({ ...prev, [request.id]: null }));
      setSandboxRejectedErrors((prev) => ({ ...prev, [request.id]: (error as Error).message }));
    } finally {
      setSandboxRejectedLoading((prev) => ({ ...prev, [request.id]: false }));
    }
  }

  return (
    <PageShell title="Appointment Requests 預約申請" description="預約申請清單，可調整處理狀態。">
      <p className="mb-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
        Sandbox 資料僅供測試，不代表正式預約，不會通知客人。
      </p>
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      {actionMessage ? (
        <p
          className={`mb-3 rounded-md px-3 py-2 text-sm ${
            actionMessageType === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
          }`}
        >
          {actionMessage}
        </p>
      ) : null}
      <SimpleTable headers={["申請編號", "來源", "寵物", "服務", "飼主", "申請時間", "狀態", "操作"]}>
        {requests.map((request) => {
          const isSandbox = request.is_sandbox ?? false;
          const isExpanded = expandedId === request.id;
          return (
            <Fragment key={request.id}>
              <tr className={isSandbox ? "bg-amber-50/60" : undefined}>
                <td className="px-4 py-3">{request.id}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      isSandbox ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {isSandbox ? "Sandbox" : "正式"}
                  </span>
                </td>
                <td className="px-4 py-3">{request.pet_name}</td>
                <td className="px-4 py-3">{request.service}</td>
                <td className="px-4 py-3">{request.owner_name}</td>
                <td className="px-4 py-3">{request.requested_at}</td>
                <td className="px-4 py-3">
                  <select
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    value={request.status}
                    onChange={(event) => updateStatus(request.id, event.target.value as AppointmentStatus)}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setExpandedId((prev) => (prev === request.id ? null : request.id));
                      }}
                    >
                      {isExpanded ? "收合詳情" : "查看詳情"}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                      onClick={() => deleteRequest(request)}
                    >
                      {isSandbox ? "刪除（Sandbox）" : "刪除"}
                    </button>
                  </div>
                </td>
              </tr>
              {isExpanded ? (
                <tr className={isSandbox ? "bg-amber-50/40" : "bg-slate-50/60"}>
                  <td className="px-4 py-3" colSpan={8}>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <h3 className="mb-2 text-sm font-semibold text-slate-800">預約詳情</h3>
                      <dl className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                        <div>
                          <dt className="font-medium text-slate-500">申請編號 id</dt>
                          <dd>{request.id}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-500">來源</dt>
                          <dd>{isSandbox ? "Sandbox" : "正式"}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-500">寵物 pet_name</dt>
                          <dd>{request.pet_name}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-500">服務 service</dt>
                          <dd>{request.service}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-500">飼主 owner_name</dt>
                          <dd>{request.owner_name}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-500">申請時間 requested_at</dt>
                          <dd>{request.requested_at}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-500">狀態 status</dt>
                          <dd>{request.status}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-500">是否為 Sandbox is_sandbox</dt>
                          <dd>{String(isSandbox)}</dd>
                        </div>
                      </dl>
                      {isSandbox ? (
                        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          這是 Sandbox 測試預約，不會通知客人。
                        </p>
                      ) : null}
                      {isSandbox && request.status === "confirmed" ? (
                        <div className="mt-3">
                          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                            {buildSandboxConfirmedMessage(request)}
                          </p>
                          <button
                            type="button"
                            className="mt-2 rounded border border-emerald-300 bg-white px-3 py-1 text-sm font-medium text-emerald-900 enabled:hover:bg-emerald-100"
                            onClick={() => appendAppointmentSandboxEvent(request, "confirmed", buildSandboxConfirmedMessage(request))}
                          >
                            確認送出沙盒回覆
                          </button>
                          {sandboxConversationWritebacks[`${request.id}:confirmed`] ? (
                            <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                              已回寫到 Conversation Logs 沙盒對話。這只是 Sandbox 模擬，不會真的通知客人。
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : null}
              {isSandbox && request.status === "proposed_new_time" ? (
                <tr className="bg-indigo-50/60">
                  <td className="px-4 py-3" colSpan={8}>
                    <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-3">
                      <h4 className="text-sm font-semibold text-indigo-900">Gemini 沙盒改約回覆</h4>
                      {(() => {
                        const staffNoteValue = sandboxStaffNotes[request.id] ?? "";
                        const hasStaffNote = Boolean(staffNoteValue.trim());
                        const geminiLoading = sandboxGeminiLoading[request.id] ?? false;
                        const geminiError = sandboxGeminiErrors[request.id] ?? "";
                        const geminiResult = sandboxGeminiResults[request.id];
                        const isConfirmed = sandboxGeminiConfirmations[request.id] ?? false;
                        const hasCustomerReply = Boolean(geminiResult?.customer_reply?.trim());

                        return (
                          <>
                            <label className="mt-2 block text-sm font-medium text-indigo-900" htmlFor={`staff-note-${request.id}`}>
                              員工改約說明
                            </label>
                            <textarea
                              id={`staff-note-${request.id}`}
                              className="mt-1 min-h-20 w-full rounded border border-indigo-300 bg-white px-2 py-1 text-sm text-slate-800"
                              placeholder="例如：明天3點可以，請幫我禮貌通知客人"
                              value={staffNoteValue}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setSandboxStaffNotes((prev) => ({ ...prev, [request.id]: nextValue }));
                                setSandboxGeminiErrors((prev) => ({ ...prev, [request.id]: "" }));
                                setSandboxGeminiResults((prev) => ({ ...prev, [request.id]: null }));
                                setSandboxGeminiConfirmations((prev) => ({ ...prev, [request.id]: false }));
                              }}
                            />
                            <button
                              type="button"
                              className="mt-3 rounded border border-indigo-300 bg-white px-3 py-1 text-sm font-medium text-indigo-900 enabled:hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!hasStaffNote || geminiLoading}
                              onClick={() => generateSandboxProposedNewTimeWithGemini(request)}
                            >
                              {geminiLoading ? "Gemini 處理中…" : "用 Gemini 產生沙盒回覆"}
                            </button>
                            {geminiError ? (
                              <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                                {geminiError}
                              </p>
                            ) : null}
                            {geminiResult ? (
                              <div className="mt-3 space-y-2">
                                {geminiResult.interpreted_time ? (
                                  <p className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-800">
                                    <span className="font-semibold text-indigo-900">Gemini 理解的新時間：</span>
                                    {geminiResult.interpreted_time}
                                  </p>
                                ) : null}
                                {geminiResult.customer_reply ? (
                                  <p className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-800">
                                    <span className="font-semibold text-indigo-900">Sandbox 改約回覆草稿：</span>
                                    {geminiResult.customer_reply}
                                  </p>
                                ) : null}
                                {geminiResult.needs_clarification ? (
                                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                    {geminiResult.staff_note}
                                  </p>
                                ) : (
                                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                    {geminiResult.staff_note}
                                  </p>
                                )}
                                {hasCustomerReply ? (
                                  <button
                                    type="button"
                                    className="rounded border border-emerald-300 bg-white px-3 py-1 text-sm font-medium text-emerald-900 enabled:hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={isConfirmed}
                                    onClick={() => {
                                      setSandboxGeminiConfirmations((prev) => ({ ...prev, [request.id]: true }));
                                      appendAppointmentSandboxEvent(request, "proposed_new_time", geminiResult.customer_reply || "");
                                    }}
                                  >
                                    {isConfirmed ? "已確認送出沙盒回覆" : "確認送出沙盒回覆"}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                            {sandboxConversationWritebacks[`${request.id}:proposed_new_time`] ? (
                              <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                                已回寫到 Conversation Logs 沙盒對話。這只是 Sandbox 模擬，不會真的通知客人。
                              </p>
                            ) : null}
                            {isConfirmed && geminiResult?.customer_reply ? (
                              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                                <h5 className="font-semibold">Sandbox 客戶端收到的回覆</h5>
                                <p className="mt-2 rounded border border-emerald-200 bg-white px-3 py-2 text-slate-800">
                                  {geminiResult.customer_reply}
                                </p>
                                <p className="mt-2 text-sm text-emerald-900">
                                  這只是 Sandbox 模擬送出，不會真的通知客人。
                                </p>
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ) : null}
              {isSandbox && request.status === "rejected" ? (
                <tr className="bg-rose-50/50">
                  <td className="px-4 py-3" colSpan={8}>
                    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-3">
                      <h4 className="text-sm font-semibold text-rose-900">Gemini 沙盒拒絕回覆</h4>
                      {(() => {
                        const rejectedNoteValue = sandboxRejectedNotes[request.id] ?? "";
                        const hasRejectedNote = Boolean(rejectedNoteValue.trim());
                        const rejectedLoading = sandboxRejectedLoading[request.id] ?? false;
                        const rejectedError = sandboxRejectedErrors[request.id] ?? "";
                        const rejectedResult = sandboxRejectedResults[request.id];
                        const isRejectedConfirmed = sandboxRejectedConfirmations[request.id] ?? false;
                        const hasCustomerReply = Boolean(rejectedResult?.customer_reply?.trim());

                        return (
                          <>
                            <label className="mt-2 block text-sm font-medium text-rose-900" htmlFor={`rejected-note-${request.id}`}>
                              員工拒絕原因
                            </label>
                            <textarea
                              id={`rejected-note-${request.id}`}
                              className="mt-1 min-h-20 w-full rounded border border-rose-300 bg-white px-2 py-1 text-sm text-slate-800"
                              placeholder="例如：今天美容時段已滿，請幫我禮貌告知客人"
                              value={rejectedNoteValue}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setSandboxRejectedNotes((prev) => ({ ...prev, [request.id]: nextValue }));
                                setSandboxRejectedErrors((prev) => ({ ...prev, [request.id]: "" }));
                                setSandboxRejectedResults((prev) => ({ ...prev, [request.id]: null }));
                                setSandboxRejectedConfirmations((prev) => ({ ...prev, [request.id]: false }));
                              }}
                            />
                            <button
                              type="button"
                              className="mt-3 rounded border border-rose-300 bg-white px-3 py-1 text-sm font-medium text-rose-900 enabled:hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!hasRejectedNote || rejectedLoading}
                              onClick={() => generateSandboxRejectedReplyWithGemini(request)}
                            >
                              {rejectedLoading ? "Gemini 處理中…" : "用 Gemini 產生沙盒拒絕回覆"}
                            </button>
                            {rejectedError ? (
                              <p className="mt-3 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-rose-800">
                                {rejectedError}
                              </p>
                            ) : null}
                            {rejectedResult ? (
                              <div className="mt-3 space-y-2">
                                {rejectedResult.customer_reply ? (
                                  <p className="rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800">
                                    <span className="font-semibold text-rose-900">Sandbox 拒絕回覆草稿：</span>
                                    {rejectedResult.customer_reply}
                                  </p>
                                ) : null}
                                {rejectedResult.needs_clarification ? (
                                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                    {rejectedResult.staff_note}
                                  </p>
                                ) : (
                                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                    {rejectedResult.staff_note}
                                  </p>
                                )}
                                {hasCustomerReply ? (
                                  <button
                                    type="button"
                                    className="rounded border border-emerald-300 bg-white px-3 py-1 text-sm font-medium text-emerald-900 enabled:hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={isRejectedConfirmed}
                                    onClick={() => {
                                      setSandboxRejectedConfirmations((prev) => ({ ...prev, [request.id]: true }));
                                      appendAppointmentSandboxEvent(request, "rejected", rejectedResult.customer_reply || "");
                                    }}
                                  >
                                    {isRejectedConfirmed ? "已確認送出沙盒回覆" : "確認送出沙盒回覆"}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                            {sandboxConversationWritebacks[`${request.id}:rejected`] ? (
                              <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                                已回寫到 Conversation Logs 沙盒對話。這只是 Sandbox 模擬，不會真的通知客人。
                              </p>
                            ) : null}
                            {isRejectedConfirmed && rejectedResult?.customer_reply ? (
                              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                                <h5 className="font-semibold">Sandbox 客戶端收到的回覆</h5>
                                <p className="mt-2 rounded border border-emerald-200 bg-white px-3 py-2 text-slate-800">
                                  {rejectedResult.customer_reply}
                                </p>
                                <p className="mt-2 text-sm text-emerald-900">
                                  這只是 Sandbox 模擬送出，不會真的通知客人。
                                </p>
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </SimpleTable>
    </PageShell>
  );
}
