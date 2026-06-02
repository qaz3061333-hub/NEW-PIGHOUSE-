"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { manualReplyTasks as mockManualReplyTasks } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { ManualReplyTask } from "@/lib/types";
import { appendSandboxManualReplyResolutionEvent, clearSandboxManualReplyResolutionEvents } from "@/lib/sandboxManualReplyResolutionEvents";
import {
  clearSandboxManualReplyTaskEvents,
  listSandboxManualReplyTaskEvents,
  markSandboxManualReplyTaskEventReplied,
  SandboxManualReplyTaskEvent,
} from "@/lib/sandboxManualReplyTaskEvents";
import {
  getSandboxManualPriorityLabel,
  getSandboxManualTaskTypeLabel,
  inferSandboxManualTaskTypeFromText,
} from "@/lib/sandboxCustomerServiceTriage";

const FALLBACK_REPLY_NOTE = "我先幫您轉給門市人員確認，稍後會由同事回覆您。";
const EMPTY_TEXT = "未提供";

function formatCreatedAt(value?: string | null) {
  if (!value) return EMPTY_TEXT;
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

function formatWorkbenchStatus(task: Pick<SandboxManualReplyTaskEvent, "is_replied" | "status">) {
  if (task.is_replied || task.status === "replied") return "已回覆";
  if (task.status === "completed") return "已完成";
  if (task.status === "collecting_info") return "資料蒐集中";
  if (task.status === "pending_human_reply" || task.status === "in_progress") return "待人工回覆";
  return "待處理";
}

function formatLegacyStatus(task: ManualReplyTask) {
  return task.is_replied ? "已回覆" : "待人工回覆";
}

function valueOrMissing(value?: string | null) {
  return value?.trim() || EMPTY_TEXT;
}

function getKnownRows(task: SandboxManualReplyTaskEvent) {
  const details = task.known_details || {};
  return [
    ["寶貝姓名", details.pet_name],
    ["品種", details.pet_type_or_breed],
    ["電話", details.phone],
    ["服務項目", details.service_item],
    ["想預約日期 / 時間", details.preferred_datetime],
  ] as Array<[string, string | undefined]>;
}

export default function ManualReplyTasksPage() {
  const [tasks, setTasks] = useState<ManualReplyTask[]>(mockManualReplyTasks);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);
  const [sandboxTasks, setSandboxTasks] = useState<SandboxManualReplyTaskEvent[]>([]);
  const [draftReplies, setDraftReplies] = useState<Record<string, string>>({});

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
        setNotice(`Supabase 讀取失敗，目前顯示 mock data：${(error as Error).message}`);
      }
    }

    load();
  }, []);

  useEffect(() => {
    const events = listSandboxManualReplyTaskEvents();
    setSandboxTasks(events);
    setDraftReplies(Object.fromEntries(events.map((task) => [task.id, task.reply_note || task.suggested_reply || FALLBACK_REPLY_NOTE])));
  }, []);

  const openSandboxTaskCount = useMemo(() => sandboxTasks.filter((task) => !task.is_replied).length, [sandboxTasks]);

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
        setNotice("更新失敗：找不到這筆人工回覆任務。");
        return;
      }
      setTasks((prev) => prev.map((item) => (item.id === id ? updated[0] : item)));
      setNotice("");
    } catch (error) {
      setNotice(`更新失敗：${(error as Error).message}`);
    }
  }

  function markSandboxReplied(task: SandboxManualReplyTaskEvent) {
    const repliedAt = new Date().toISOString();
    const replyText = draftReplies[task.id]?.trim() || task.reply_note || FALLBACK_REPLY_NOTE;
    markSandboxManualReplyTaskEventReplied(task.id, repliedAt);
    appendSandboxManualReplyResolutionEvent({
      id: `sandbox-manual-reply-resolution-${Date.now()}`,
      source: "manual_reply_tasks",
      manual_reply_task_id: task.id,
      customer: task.customer,
      topic: task.topic,
      last_message: task.last_message,
      reply_note: replyText,
      resolution_note: "Sandbox 模擬送出 LINE 回覆，未送真 LINE。",
      created_at: repliedAt,
    });
    setSandboxTasks(listSandboxManualReplyTaskEvents());
    setNotice("已更新 sandbox 任務狀態為「已回覆」。沒有送出真 LINE，也沒有寫入正式 messages。");
  }

  function clearSandboxTasksSection() {
    clearSandboxManualReplyTaskEvents();
    clearSandboxManualReplyResolutionEvents();
    setSandboxTasks([]);
    setDraftReplies({});
    setNotice("已清除 sandbox 人工回覆工作台任務。");
  }

  return (
    <PageShell title="人工回覆工作台" description="員工每天主要處理的 LINE 客服任務入口">
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Sandbox 任務</h3>
            <p className="mt-1 text-sm text-slate-600">
              預約、改約取消、報價補資料、客訴退款、異常高風險、KB 找不到與 AI 不確定都集中在這裡。
            </p>
          </div>
          <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" onClick={clearSandboxTasksSection}>
            清除 Sandbox 任務
          </button>
        </div>

        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          待處理 sandbox 任務：<span className="font-semibold text-slate-950">{openSandboxTaskCount}</span>
        </div>

        <div className="mt-4 grid gap-4">
          {sandboxTasks.length === 0 ? <p className="text-sm text-slate-600">目前沒有 sandbox 人工任務。</p> : null}
          {sandboxTasks.map((task) => {
            const taskType = task.task_type || inferSandboxManualTaskTypeFromText(`${task.topic} ${task.last_message} ${task.reply_note}`);
            const missingDetails = task.missing_details || [];
            const draftValue = draftReplies[task.id] ?? task.reply_note ?? task.suggested_reply ?? FALLBACK_REPLY_NOTE;
            return (
              <article key={task.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-slate-950">{getSandboxManualTaskTypeLabel(taskType)}</h4>
                    <p className="mt-1 text-xs text-slate-500">建立時間：{formatCreatedAt(task.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">優先度：{getSandboxManualPriorityLabel(task.priority)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{formatWorkbenchStatus(task)}</span>
                  </div>
                </div>

                <dl className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-500">客人原始訊息</dt>
                    <dd className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-slate-900">{task.last_message}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">AI 整理摘要</dt>
                    <dd className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-slate-900">
                      {task.ai_summary || task.classification_reason || task.topic}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">已知資料</dt>
                    <dd className="mt-1 rounded-md bg-slate-50 px-3 py-2">
                      <dl className="grid gap-2 sm:grid-cols-2">
                        {getKnownRows(task).map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-xs text-slate-500">{label}</dt>
                            <dd className="text-slate-900">{valueOrMissing(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">缺少資料</dt>
                    <dd className="mt-1 rounded-md bg-slate-50 px-3 py-2 text-slate-900">
                      {missingDetails.length > 0 ? missingDetails.map((item) => `缺${item}`).join("、") : "無明顯缺漏"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">系統建議回覆草稿</dt>
                    <dd className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-slate-900">
                      {task.suggested_reply || task.reply_note || FALLBACK_REPLY_NOTE}
                    </dd>
                  </div>
                  <label className="block">
                    <span className="font-medium text-slate-500">員工可編輯回覆草稿</span>
                    <textarea
                      className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={draftValue}
                      onChange={(event) => setDraftReplies((prev) => ({ ...prev, [task.id]: event.target.value }))}
                      disabled={task.is_replied}
                    />
                  </label>
                </dl>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    onClick={() => markSandboxReplied(task)}
                    disabled={task.is_replied}
                  >
                    模擬送出 LINE 回覆
                  </button>
                  <span className="text-xs text-slate-500">Sandbox only：只更新 localStorage 狀態，不送真 LINE。</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">舊版資料表</h3>
        <p className="mt-1 text-sm text-slate-600">保留既有 manual_reply_tasks 資料，不改 schema；新 sandbox 任務卡片以上方工作台為主。</p>
        <div className="mt-3">
          <SimpleTable headers={["客人", "任務類型", "客人訊息", "建議回覆", "優先度 / 狀態", "動作"]}>
            {tasks.map((task) => {
              const lastMessage = task.last_message?.trim() || task.topic;
              const replyNote = task.reply_note?.trim() || FALLBACK_REPLY_NOTE;
              const taskType = inferSandboxManualTaskTypeFromText(`${task.topic} ${lastMessage} ${replyNote}`);

              return (
                <tr key={task.id}>
                  <td className="px-4 py-3">
                    <div>{task.customer}</div>
                    <div className="mt-1 text-xs text-slate-500">{task.source_channel?.trim() || "LINE"}</div>
                  </td>
                  <td className="px-4 py-3">{getSandboxManualTaskTypeLabel(taskType)}</td>
                  <td className="max-w-xs whitespace-pre-wrap px-4 py-3 text-slate-700">{lastMessage}</td>
                  <td className="max-w-xs whitespace-pre-wrap px-4 py-3 text-slate-700">{replyNote}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>優先度：{getSandboxManualPriorityLabel(task.priority)}</div>
                    <div className="mt-1">狀態：{formatLegacyStatus(task)}</div>
                  </td>
                  <td className="px-4 py-3">
                    {task.is_replied ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">已回覆</span>
                    ) : (
                      <button className="rounded-md border border-slate-300 px-2 py-1 text-xs" onClick={() => markReplied(task.id)} type="button">
                        標記已回覆
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </SimpleTable>
        </div>
      </section>
    </PageShell>
  );
}
