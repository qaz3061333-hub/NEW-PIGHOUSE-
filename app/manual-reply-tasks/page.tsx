"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { manualReplyTasks as mockManualReplyTasks } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { ManualReplyTask } from "@/lib/types";
import { appendSandboxManualReplyResolutionEvent, clearSandboxManualReplyResolutionEvents } from "@/lib/sandboxManualReplyResolutionEvents";
import { clearSandboxManualReplyTaskEvents, listSandboxManualReplyTaskEvents, markSandboxManualReplyTaskEventReplied, SandboxManualReplyTaskEvent } from "@/lib/sandboxManualReplyTaskEvents";
import {
  getSandboxManualPriorityLabel,
  getSandboxManualTaskTypeLabel,
  getSandboxTriageResultLabel,
  inferSandboxManualTaskTypeFromText,
} from "@/lib/sandboxCustomerServiceTriage";

const FALLBACK_REPLY_NOTE = "請依顧客需求人工回覆";

function formatTaskStatus(isReplied: boolean, status?: SandboxManualReplyTaskEvent["status"]) {
  if (isReplied || status === "replied") return "已回覆";
  if (status === "in_progress") return "處理中";
  return "未處理";
}

function formatAutoReplied(value?: boolean) {
  if (value === true) return "已自動回覆安全訊息";
  if (value === false) return "未自動回覆";
  return "既有資料未記錄";
}

function formatCreatedAt(value?: string | null) {
  if (!value) return "未記錄";
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

export default function ManualReplyTasksPage() {
  const [tasks, setTasks] = useState<ManualReplyTask[]>(mockManualReplyTasks);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);
  const [sandboxTasks, setSandboxTasks] = useState<SandboxManualReplyTaskEvent[]>([]);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

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

  useEffect(() => {
    setSandboxTasks(listSandboxManualReplyTaskEvents());
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

  async function copySandboxReplyNote(task: SandboxManualReplyTaskEvent) {
    const textToCopy = task.reply_note?.trim() || FALLBACK_REPLY_NOTE;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setNotice("已複製回覆重點");
    } catch {
      setNotice("複製失敗，請手動複製。");
    }
  }

  function markSandboxReplied(task: SandboxManualReplyTaskEvent) {
    const repliedAt = new Date().toISOString();
    const resolutionNote = resolutionNotes[task.id]?.trim() || "已標記為沙盒人工回覆完成。";
    markSandboxManualReplyTaskEventReplied(task.id, repliedAt);
    appendSandboxManualReplyResolutionEvent({
      id: `sandbox-manual-reply-resolution-${Date.now()}`,
      source: "manual_reply_tasks",
      manual_reply_task_id: task.id,
      customer: task.customer,
      topic: task.topic,
      last_message: task.last_message,
      reply_note: task.reply_note,
      resolution_note: resolutionNote,
      created_at: repliedAt,
    });
    setSandboxTasks(listSandboxManualReplyTaskEvents());
    setNotice("已標記沙盒已回覆，並回寫到 Conversation Logs 沙盒訊息。");
  }

  function clearSandboxTasksSection() {
    clearSandboxManualReplyTaskEvents();
    clearSandboxManualReplyResolutionEvents();
    setSandboxTasks([]);
    setResolutionNotes({});
    setNotice("已清除 Sandbox 人工回覆任務。");
  }

  return (
    <PageShell title="人工回覆工作台" description="無法自動回覆、需客服介入的對話任務。">
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      <section className="mb-4 rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-fuchsia-900">Sandbox 人工回覆任務</h3>
          <button type="button" className="rounded border border-fuchsia-300 px-2 py-1 text-xs text-fuchsia-900" onClick={clearSandboxTasksSection}>清除 Sandbox 人工回覆任務</button>
        </div>
        <p className="mt-2 text-sm text-fuchsia-900">這些是同一瀏覽器 localStorage 沙盒資料，不是正式人工回覆任務，不會通知客人。</p>
        <div className="mt-3 grid gap-3">
          {sandboxTasks.length === 0 ? <p className="text-sm text-slate-600">目前沒有 Sandbox 人工待辦。</p> : null}
          {sandboxTasks.map((task) => (
            <article key={task.id} className="rounded-lg border border-fuchsia-200 bg-white p-4 text-sm text-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-slate-950">{getSandboxManualTaskTypeLabel(task.task_type)}</h4>
                  <p className="mt-1 text-xs text-slate-500">建立時間：{formatCreatedAt(task.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">優先度：{getSandboxManualPriorityLabel(task.priority)}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{formatTaskStatus(task.is_replied, task.status)}</span>
                </div>
              </div>
              <dl className="mt-3 grid gap-2 md:grid-cols-2">
                <div>
                  <dt className="font-medium">客人原始訊息</dt>
                  <dd className="whitespace-pre-wrap">{task.last_message}</dd>
                </div>
                <div>
                  <dt className="font-medium">系統分類原因</dt>
                  <dd>{task.classification_reason || "既有沙盒任務沒有獨立分類原因，請參考主題與原始訊息。"}</dd>
                </div>
                <div>
                  <dt className="font-medium">triage result</dt>
                  <dd>{task.triage_result || "未記錄"}（{getSandboxTriageResultLabel(task.triage_result)}）</dd>
                </div>
                <div>
                  <dt className="font-medium">是否已自動回覆過</dt>
                  <dd>{formatAutoReplied(task.auto_replied)}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="font-medium">系統建議回覆草稿</dt>
                  <dd className="whitespace-pre-wrap">{task.suggested_reply || task.reply_note || FALLBACK_REPLY_NOTE}</dd>
                </div>
                {task.knowledge_fallback_reason ? (
                  <div className="md:col-span-2">
                    <dt className="font-medium">Knowledge Base fallback reason</dt>
                    <dd>{task.knowledge_fallback_reason}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => copySandboxReplyNote(task)} type="button">複製回覆草稿</button>
                {task.is_replied ? null : (
                  <>
                    <input className="rounded border border-slate-300 px-2 py-1 text-xs" placeholder="處理備註（選填）" value={resolutionNotes[task.id] || ""} onChange={(event) => setResolutionNotes((prev) => ({ ...prev, [task.id]: event.target.value }))} />
                    <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => markSandboxReplied(task)} type="button">標記沙盒已回覆</button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      <SimpleTable headers={["客戶 / 狀態", "原始訊息", "分類原因 / 類型", "建議回覆草稿", "建立時間 / 優先度", "操作"]}>
        {tasks.map((task) => {
          const sourceChannel = task.source_channel?.trim() || "LINE";
          const lastMessage = task.last_message?.trim() || "尚無最後訊息";
          const replyNote = task.reply_note?.trim() || "尚無建議回覆重點";
          const archiveStatus = task.archive_status?.trim() || "未設定";
          const taskType = inferSandboxManualTaskTypeFromText(`${task.topic} ${lastMessage} ${replyNote}`);
          const taskStatus = task.is_replied ? "已回覆" : "未處理";
          const classificationReason = "既有 manual_reply_tasks 欄位沒有獨立分類原因，先用主題與原始訊息輔助判斷。";

          return (
            <tr key={task.id}>
              <td className="px-4 py-3">
                <div>{task.customer}</div>
                {task.customer_line_user_id ? <div className="text-xs text-slate-500">LINE ID: {task.customer_line_user_id}</div> : null}
                <div className="mt-1 text-xs text-slate-500">來源：{sourceChannel || "未指定"}</div>
                <div className="mt-1 text-xs text-slate-500">狀態：{taskStatus}</div>
                <details className="mt-1 text-xs text-slate-500">
                  <summary className="cursor-pointer select-none">詳細資訊</summary>
                  <div className="mt-1">任務編號：{task.id}</div>
                  <div>是否已自動回覆過：既有資料未記錄</div>
                  <div>封存狀態：{archiveStatus}</div>
                </details>
              </td>
              <td className="max-w-xs px-4 py-3 text-sm text-slate-700">{lastMessage}</td>
              <td className="max-w-xs px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">{getSandboxManualTaskTypeLabel(taskType)}</div>
                <div className="mt-1">{classificationReason}</div>
                <div className="mt-1 text-xs text-slate-500">主題：{task.topic}</div>
              </td>
              <td className="max-w-xs px-4 py-3 text-sm text-slate-700">{replyNote}</td>
              <td className="px-4 py-3 text-sm text-slate-700">
                <div>{formatCreatedAt(task.created_at)}</div>
                <div className="mt-1">等待：{task.waiting_minutes} 分鐘</div>
                <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">優先度：{getSandboxManualPriorityLabel(task.priority)}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-2">
                  <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => copyReplyNote(task)} type="button">
                    複製回覆草稿
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
