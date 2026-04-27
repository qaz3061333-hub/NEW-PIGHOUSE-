"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { appointmentRequests as mockAppointmentRequests } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { AppointmentRequest, AppointmentStatus } from "@/lib/types";

const statusOptions: AppointmentStatus[] = ["pending", "confirmed", "proposed_new_time", "rejected"];

export default function AppointmentRequestsPage() {
  const [requests, setRequests] = useState<AppointmentRequest[]>(mockAppointmentRequests);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);

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

  return (
    <PageShell title="Appointment Requests 預約申請" description="預約申請清單，可調整處理狀態。">
      <p className="mb-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
        Sandbox 資料僅供測試，不代表正式預約，不會通知客人。
      </p>
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      <SimpleTable headers={["申請編號", "來源", "寵物", "服務", "飼主", "申請時間", "狀態"]}>
        {requests.map((request) => {
          const isSandbox = request.is_sandbox ?? false;
          return (
            <tr key={request.id} className={isSandbox ? "bg-amber-50/60" : undefined}>
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
            </tr>
          );
        })}
      </SimpleTable>
    </PageShell>
  );
}
