"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { manualReplyTasks as mockManualReplyTasks } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { ManualReplyTask } from "@/lib/types";

const FALLBACK_REPLY_NOTE = "請依顧客需求人工回覆";

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
        setNotice("");
      } catch (error) {
        setNotice(`Supabase 讀取失敗，已使用 mock data。${(error as Error).message}`);
      }
    }

    load();
  }, []);

  async function markReplied(id: string) {
    if (!isSupabaseConfigured) {
      setTasks((prev) => prev.map((item) => (item.id === id ? { ...item, is_replied: true, replied_at: new Date().toISOString() } : item)));
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
      if (!updated[0]) {
        setNotice("更新失敗：找不到對應資料列。");
        return;
      }
      setTasks((prev) => prev.map((item) => (item.id === id ? updated[0] : item)));
      setNotice("");
    } catch (error) {
      setNotice(`更新失敗：${(error as Error).message}`);
    }
  }

  async function copyReplyNote(task: ManualReplyTask) {
    const textToCopy = task.reply_note?.trim() || FALLBACK_REPLY_NOTE;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setNotice("已複製回覆重點");
    } catch {
      setNotice("複製失敗，請手動複製。");
    }
  }

  return (
    <PageShell title="人工回覆工作台" description="無法自動回覆、需客服介入的對話任務。">
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      <SimpleTable headers={["客戶", "來源渠道", "主題", "最後訊息", "建議回覆重點", "等待時間（分鐘）", "優先度", "狀態 / 操作"]}>
        {tasks.map((task) => {
          const sourceChannel = task.source_channel?.trim() || "LINE";
          const lastMessage = task.last_message?.trim() || "尚無最後訊息";
          const replyNote = task.reply_note?.trim() || "尚無建議回覆重點";

          return (
            <tr key={task.id}>
              <td className="px-4 py-3">
                <div>{task.customer}</div>
                {task.customer_line_user_id ? <div className="text-xs text-slate-500">LINE ID: {task.customer_line_user_id}</div> : null}
                <details className="mt-1 text-xs text-slate-500">
                  <summary className="cursor-pointer select-none">詳細資訊</summary>
                  <div className="mt-1">任務編號：{task.id}</div>
                </details>
              </td>
              <td className="px-4 py-3">{sourceChannel || "未指定"}</td>
              <td className="px-4 py-3">{task.topic}</td>
              <td className="max-w-xs px-4 py-3 text-sm text-slate-700">{lastMessage}</td>
              <td className="max-w-xs px-4 py-3 text-sm text-slate-700">{replyNote}</td>
              <td className="px-4 py-3">{task.waiting_minutes}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">{task.priority}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-2">
                  <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => copyReplyNote(task)} type="button">
                    複製回覆重點
                  </button>
                  {task.is_replied ? (
                    <span className="inline-block rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">已回覆</span>
                  ) : (
                    <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => markReplied(task.id)} type="button">
                      標記已回覆
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </SimpleTable>
    </PageShell>
  );
}
