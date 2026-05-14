"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { abnormalAlerts as mockAbnormalAlerts } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { AbnormalAlert } from "@/lib/types";
import { clearSandboxAbnormalAlertEvents, listSandboxAbnormalAlertEvents, markSandboxAbnormalAlertEventResolved, SandboxAbnormalAlertEvent } from "@/lib/sandboxAbnormalAlertEvents";

export default function AbnormalAlertsPage() {
  const [alerts, setAlerts] = useState<AbnormalAlert[]>(mockAbnormalAlerts);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);
  const [sandboxAlerts, setSandboxAlerts] = useState<SandboxAbnormalAlertEvent[]>([]);

  useEffect(() => {
    setSandboxAlerts(listSandboxAbnormalAlertEvents());
  }, []);

  useEffect(() => {
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
      if (!updated[0]) {
        setNotice("更新失敗：找不到對應資料列。");
        return;
      }
      setAlerts((prev) => prev.map((item) => (item.id === id ? updated[0] : item)));
      setNotice("");
    } catch (error) {
      setNotice(`更新失敗：${(error as Error).message}`);
    }
  }



  function markSandboxResolved(id: string) {
    setSandboxAlerts(markSandboxAbnormalAlertEventResolved(id));
  }

  function clearSandboxAlerts() {
    clearSandboxAbnormalAlertEvents();
    setSandboxAlerts([]);
  }

  return (
    <PageShell title="Abnormal Alerts 異常提醒" description="系統偵測到需要客服關注的異常事件。">
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}

      <section className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-amber-900">Sandbox 異常提醒</h2>
          <button type="button" onClick={clearSandboxAlerts} className="rounded border border-amber-300 bg-white px-3 py-1 text-sm text-amber-900">
            清除 Sandbox 異常提醒
          </button>
        </div>
        <p className="mt-2 text-sm text-amber-900">
          這些是同一瀏覽器 localStorage 沙盒資料，不是正式異常提醒，不會通知客人。
        </p>
        {sandboxAlerts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">目前沒有 Sandbox 異常提醒。</p>
        ) : (
          <div className="mt-3 space-y-2">
            {sandboxAlerts.map((alert) => (
              <div key={alert.id} className="rounded border border-amber-200 bg-white p-3 text-sm">
                <p className="text-xs text-slate-500">{alert.created_at}</p>
                <p className="mt-1"><span className="font-medium">嚴重度：</span>{alert.severity}</p>
                <p><span className="font-medium">標題：</span>{alert.title}</p>
                <p><span className="font-medium">摘要：</span>{alert.summary}</p>
                <p><span className="font-medium">原始客人訊息：</span>{alert.customer_message}</p>
                {alert.is_resolved ? (
                  <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">已處理</span>
                ) : (
                  <button type="button" onClick={() => markSandboxResolved(alert.id)} className="mt-2 rounded border border-slate-300 px-2 py-1 text-xs">
                    標記沙盒已處理
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

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
