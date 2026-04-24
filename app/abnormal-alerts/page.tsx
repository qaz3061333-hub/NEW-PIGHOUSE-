"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { abnormalAlerts as mockAbnormalAlerts } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { AbnormalAlert } from "@/lib/types";

export default function AbnormalAlertsPage() {
  const [alerts, setAlerts] = useState<AbnormalAlert[]>(mockAbnormalAlerts);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) return;
      try {
        const data = await supabaseRequest<AbnormalAlert[]>({
          table: "abnormal_alerts",
          query: "select=*&order=triggered_at.desc",
        });
        setAlerts(data);
      } catch (error) {
        setNotice(`Supabase 讀取失敗，已使用 mock data。${(error as Error).message}`);
      }
    }

    load();
  }, []);

  async function markResolved(id: string) {
    if (!isSupabaseConfigured) {
      setAlerts((prev) => prev.map((item) => (item.id === id ? { ...item, is_resolved: true } : item)));
      setNotice(supabaseEnvWarning);
      return;
    }

    try {
      const updated = await supabaseRequest<AbnormalAlert[]>({
        table: "abnormal_alerts",
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(id)}`,
        body: { is_resolved: true, resolved_at: new Date().toISOString() },
        prefer: "return=representation",
      });
      setAlerts((prev) => prev.map((item) => (item.id === id ? updated[0] : item)));
    } catch (error) {
      setNotice(`更新失敗：${(error as Error).message}`);
    }
  }

  return (
    <PageShell title="Abnormal Alerts 異常提醒" description="系統偵測到需要客服關注的異常事件。">
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      <SimpleTable headers={["事件編號", "嚴重度", "標題", "觸發時間", "摘要", "處理"]}>
        {alerts.map((alert) => (
          <tr key={alert.id}>
            <td className="px-4 py-3">{alert.id}</td>
            <td className="px-4 py-3">
              <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-700">{alert.severity}</span>
            </td>
            <td className="px-4 py-3">{alert.title}</td>
            <td className="px-4 py-3">{alert.triggered_at}</td>
            <td className="px-4 py-3">{alert.summary}</td>
            <td className="px-4 py-3">
              {alert.is_resolved ? (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">已處理</span>
              ) : (
                <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => markResolved(alert.id)} type="button">
                  標記已處理
                </button>
              )}
            </td>
          </tr>
        ))}
      </SimpleTable>
    </PageShell>
  );
}
