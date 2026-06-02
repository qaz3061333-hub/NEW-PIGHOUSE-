"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { appointmentRequests as mockAppointmentRequests } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { AppointmentRequest } from "@/lib/types";

function formatRequestedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

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
        setNotice(`Supabase 讀取失敗，目前顯示 mock data：${(error as Error).message}`);
      }
    }

    load();
  }, []);

  return (
    <PageShell title="Appointment Requests（舊版沙盒資料）" description="暫時保留的舊版預約資料檢視，不是目前 MVP 主流程">
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">目前 MVP 不做線上預約系統。</p>
        <p className="mt-1">
          預約、問空檔、改約、取消會先進{" "}
          <Link className="font-semibold underline" href="/manual-reply-tasks">
            人工回覆工作台
          </Link>{" "}
          處理。本頁暫時保留作為舊版沙盒資料，不是主流程。
        </p>
        <p className="mt-1">本頁不查 POS、不查 Google Calendar、不送 LINE，也不代表正式預約成功。</p>
      </section>

      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}

      <SimpleTable headers={["ID", "來源", "寶貝", "服務", "飼主", "需求時間", "舊版狀態"]}>
        {requests.map((request) => (
          <tr key={request.id}>
            <td className="px-4 py-3">{request.id}</td>
            <td className="px-4 py-3">{request.is_sandbox ? "Sandbox" : "舊資料"}</td>
            <td className="px-4 py-3">{request.pet_name}</td>
            <td className="px-4 py-3">{request.service}</td>
            <td className="px-4 py-3">{request.owner_name}</td>
            <td className="px-4 py-3">{formatRequestedAt(request.requested_at)}</td>
            <td className="px-4 py-3">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{request.status}</span>
            </td>
          </tr>
        ))}
      </SimpleTable>
    </PageShell>
  );
}
