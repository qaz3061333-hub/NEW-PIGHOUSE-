"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { abnormalAlerts as mockAbnormalAlerts } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { AbnormalAlert } from "@/lib/types";
import { listSandboxAbnormalAlertEvents, SandboxAbnormalAlertEvent } from "@/lib/sandboxAbnormalAlertEvents";

function formatCreatedAt(value: string) {
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

export default function AbnormalAlertsPage() {
  const [alerts, setAlerts] = useState<AbnormalAlert[]>(mockAbnormalAlerts);
  const [sandboxAlerts, setSandboxAlerts] = useState<SandboxAbnormalAlertEvent[]>([]);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);

  useEffect(() => {
    setSandboxAlerts(listSandboxAbnormalAlertEvents());

    async function load() {
      if (!isSupabaseConfigured) return;
      try {
        const data = await supabaseRequest<AbnormalAlert[]>({
          table: "abnormal_alerts",
          query: "select=*&order=triggered_at.desc",
        });
        setAlerts(data);
        setNotice("");
      } catch (error) {
        setNotice(`Supabase 讀取失敗，目前顯示 mock data：${(error as Error).message}`);
      }
    }

    load();
  }, []);

  return (
    <PageShell title="Abnormal Alerts（舊版異常提醒沙盒）" description="暫時保留的舊版異常提醒檢視，不是目前 MVP 主流程">
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">
          目前高風險、異常、流血、流膿、受傷、攻擊性、老犬高風險等訊息，會進人工回覆工作台。
        </p>
        <p className="mt-1">
          本頁暫時保留作為舊版異常提醒沙盒，不是主流程。請以{" "}
          <Link className="font-semibold underline" href="/manual-reply-tasks">
            人工回覆工作台
          </Link>{" "}
          為主要處理入口。
        </p>
      </section>

      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}

      <section className="rounded-lg border bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Conversation Logs 產生的舊版 sandbox alert</h3>
        <div className="mt-3">
          <SimpleTable headers={["ID", "風險", "標題", "客人訊息", "摘要", "建立時間"]}>
            {sandboxAlerts.map((alert) => (
              <tr key={alert.id}>
                <td className="px-4 py-3">{alert.id}</td>
                <td className="px-4 py-3">{alert.severity}</td>
                <td className="px-4 py-3">{alert.title}</td>
                <td className="px-4 py-3">{alert.customer_message}</td>
                <td className="px-4 py-3">{alert.summary}</td>
                <td className="px-4 py-3">{formatCreatedAt(alert.created_at)}</td>
              </tr>
            ))}
          </SimpleTable>
          {sandboxAlerts.length === 0 ? <p className="mt-3 text-sm text-slate-600">目前沒有舊版 sandbox alert。</p> : null}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">舊版 abnormal_alerts 資料</h3>
        <div className="mt-3">
          <SimpleTable headers={["ID", "風險", "標題", "觸發時間", "摘要", "狀態"]}>
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td className="px-4 py-3">{alert.id}</td>
                <td className="px-4 py-3">{alert.severity}</td>
                <td className="px-4 py-3">{alert.title}</td>
                <td className="px-4 py-3">{formatCreatedAt(alert.triggered_at)}</td>
                <td className="px-4 py-3">{alert.summary}</td>
                <td className="px-4 py-3">{alert.is_resolved ? "已處理" : "舊版未處理"}</td>
              </tr>
            ))}
          </SimpleTable>
        </div>
      </section>
    </PageShell>
  );
}
