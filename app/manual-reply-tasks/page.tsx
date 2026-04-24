"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { manualReplyTasks as mockManualReplyTasks } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { ManualReplyTask } from "@/lib/types";

export default function ManualReplyTasksPage() {
  const [tasks, setTasks] = useState<ManualReplyTask[]>(mockManualReplyTasks);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) return;
      try {
        const data = await supabaseRequest<ManualReplyTask[]>({
          table: "manual_reply_tasks",
          query: "select=*&order=waiting_minutes.desc",
        });
        setTasks(data);
      } catch (error) {
        setNotice(`Supabase 讀取失敗，已使用 mock data。${(error as Error).message}`);
      }
    }

    load();
  }, []);

  async function markReplied(id: string) {
    if (!isSupabaseConfigured) {
      setTasks((prev) => prev.map((item) => (item.id === id ? { ...item, is_replied: true } : item)));
      setNotice(supabaseEnvWarning);
      return;
    }

    try {
      const updated = await supabaseRequest<ManualReplyTask[]>({
        table: "manual_reply_tasks",
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(id)}`,
        body: { is_replied: true, replied_at: new Date().toISOString() },
        prefer: "return=representation",
      });
      setTasks((prev) => prev.map((item) => (item.id === id ? updated[0] : item)));
    } catch (error) {
      setNotice(`更新失敗：${(error as Error).message}`);
    }
  }

  return (
    <PageShell title="Manual Reply Tasks 需人工回覆" description="無法自動回覆、需客服介入的對話任務。">
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      <SimpleTable headers={["任務編號", "客戶", "主題", "等待時間（分鐘）", "優先度", "狀態"]}>
        {tasks.map((task) => (
          <tr key={task.id}>
            <td className="px-4 py-3">{task.id}</td>
            <td className="px-4 py-3">{task.customer}</td>
            <td className="px-4 py-3">{task.topic}</td>
            <td className="px-4 py-3">{task.waiting_minutes}</td>
            <td className="px-4 py-3">
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">{task.priority}</span>
            </td>
            <td className="px-4 py-3">
              {task.is_replied ? (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">已回覆</span>
              ) : (
                <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => markReplied(task.id)} type="button">
                  標記已回覆
                </button>
              )}
            </td>
          </tr>
        ))}
      </SimpleTable>
    </PageShell>
  );
}
