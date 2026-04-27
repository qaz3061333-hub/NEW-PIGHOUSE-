"use client";

import { Fragment, useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { appointmentRequests as mockAppointmentRequests } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { AppointmentRequest, AppointmentStatus } from "@/lib/types";

const statusOptions: AppointmentStatus[] = ["pending", "confirmed", "proposed_new_time", "rejected"];

export default function AppointmentRequestsPage() {
  const [requests, setRequests] = useState<AppointmentRequest[]>(mockAppointmentRequests);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);
  const [actionMessage, setActionMessage] = useState<string>("");
  const [actionMessageType, setActionMessageType] = useState<"success" | "error">("success");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
