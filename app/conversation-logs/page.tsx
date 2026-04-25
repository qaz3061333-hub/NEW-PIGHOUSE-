"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { conversationLogs as mockConversationLogs } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { ConversationLog } from "@/lib/types";

type SandboxScenario = "confirm" | "reschedule" | "reject";

export default function ConversationLogsPage() {
  const [logs, setLogs] = useState<ConversationLog[]>(mockConversationLogs);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);
  const [scenario, setScenario] = useState<SandboxScenario>("confirm");
  const [sandboxReply, setSandboxReply] = useState("");
  const [confirmForm, setConfirmForm] = useState({
    customerName: "",
    appointmentDate: "",
    appointmentTime: "",
    serviceItem: "",
    note: "",
  });
  const [rescheduleForm, setRescheduleForm] = useState({
    customerName: "",
    originalDate: "",
    originalTime: "",
    serviceItem: "",
    alternativeTimes: "",
    note: "",
  });
  const [rejectForm, setRejectForm] = useState({
    customerName: "",
    requestDetail: "",
    rejectReason: "",
    note: "",
  });

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) return;
      try {
        const data = await supabaseRequest<ConversationLog[]>({
          table: "messages",
          query: "select=id,channel,content,created_at,customers(name)&order=created_at.desc",
        });

        const mapped: ConversationLog[] = data.map((row: ConversationLog & { content?: string; created_at?: string; customers?: { name?: string } }) => ({
          id: row.id,
          customer: row.customers?.name ?? "未知客戶",
          channel: row.channel,
          last_message: row.content ?? row.last_message,
          updated_at: row.created_at ?? row.updated_at,
        }));

        setLogs(mapped);
      } catch (error) {
        setNotice(`Supabase 讀取失敗，已使用 mock data。${(error as Error).message}`);
      }
    }

    load();
  }, []);

  function generateSandboxReply() {
    if (scenario === "confirm") {
      const noteText = confirmForm.note.trim() ? ` 備註：${confirmForm.note.trim()}。` : "";
      setSandboxReply(
        `您好 ${confirmForm.customerName || "貴賓"}，已為您確認預約：${confirmForm.appointmentDate || "（日期待確認）"} ${confirmForm.appointmentTime || "（時間待確認）"}，服務項目為${confirmForm.serviceItem || "（服務待確認）"}。期待您的到來！${noteText}`,
      );
      return;
    }

    if (scenario === "reschedule") {
      const alternatives = rescheduleForm.alternativeTimes
        .split(/[\n,，]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const alternativeText = alternatives.length ? alternatives.join("、") : "（尚未提供可改約時段）";
      const noteText = rescheduleForm.note.trim() ? ` 備註：${rescheduleForm.note.trim()}。` : "";
      setSandboxReply(
        `您好 ${rescheduleForm.customerName || "貴賓"}，您原本想預約的 ${rescheduleForm.originalDate || "（日期待確認）"} ${rescheduleForm.originalTime || "（時間待確認）"}（${rescheduleForm.serviceItem || "服務待確認"}）目前已滿。以下時間目前可以安排：${alternativeText}。請問哪個時間方便呢？${noteText}`,
      );
      return;
    }

    const noteText = rejectForm.note.trim() ? ` 備註：${rejectForm.note.trim()}。` : "";
    setSandboxReply(
      `您好 ${rejectForm.customerName || "貴賓"}，很抱歉，因為${rejectForm.rejectReason || "目前條件限制"}，本次「${rejectForm.requestDetail || "預約需求"}」暫時無法安排。謝謝您的理解。${noteText}`,
    );
  }

  return (
    <PageShell title="Conversation Logs 對話紀錄" description="客服與顧客歷史對話摘要。">
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      <SimpleTable headers={["對話編號", "客戶", "來源", "最後訊息", "更新時間"]}>
        {logs.map((log) => (
          <tr key={log.id}>
            <td className="px-4 py-3">{log.id}</td>
            <td className="px-4 py-3">{log.customer}</td>
            <td className="px-4 py-3">{log.channel}</td>
            <td className="px-4 py-3">{log.last_message}</td>
            <td className="px-4 py-3">{log.updated_at}</td>
          </tr>
        ))}
      </SimpleTable>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">AI / LINE 回覆沙盒模擬</h2>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          這是沙盒模擬，不會真的送出 LINE 訊息。
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="sandbox-scenario">
            模擬情境
          </label>
          <select
            id="sandbox-scenario"
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={scenario}
            onChange={(event) => {
              setScenario(event.target.value as SandboxScenario);
              setSandboxReply("");
            }}
          >
            <option value="confirm">確認預約</option>
            <option value="reschedule">需要改時間</option>
            <option value="reject">拒絕預約</option>
          </select>
        </div>

        {scenario === "confirm" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              客人名稱
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={confirmForm.customerName}
                onChange={(event) => setConfirmForm((prev) => ({ ...prev, customerName: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              預約日期
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={confirmForm.appointmentDate}
                onChange={(event) => setConfirmForm((prev) => ({ ...prev, appointmentDate: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              預約時間
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={confirmForm.appointmentTime}
                onChange={(event) => setConfirmForm((prev) => ({ ...prev, appointmentTime: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              服務項目
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={confirmForm.serviceItem}
                onChange={(event) => setConfirmForm((prev) => ({ ...prev, serviceItem: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700 md:col-span-2">
              備註（可選）
              <textarea
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                rows={2}
                value={confirmForm.note}
                onChange={(event) => setConfirmForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>
          </div>
        ) : null}

        {scenario === "reschedule" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              客人名稱
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={rescheduleForm.customerName}
                onChange={(event) => setRescheduleForm((prev) => ({ ...prev, customerName: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              原本想預約的日期
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={rescheduleForm.originalDate}
                onChange={(event) => setRescheduleForm((prev) => ({ ...prev, originalDate: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              原本想預約的時間
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={rescheduleForm.originalTime}
                onChange={(event) => setRescheduleForm((prev) => ({ ...prev, originalTime: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              服務項目
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={rescheduleForm.serviceItem}
                onChange={(event) => setRescheduleForm((prev) => ({ ...prev, serviceItem: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700 md:col-span-2">
              可提供的新時間（可輸入一個或多個，逗號或換行分隔）
              <textarea
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                value={rescheduleForm.alternativeTimes}
                onChange={(event) => setRescheduleForm((prev) => ({ ...prev, alternativeTimes: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700 md:col-span-2">
              備註（可選）
              <textarea
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                rows={2}
                value={rescheduleForm.note}
                onChange={(event) => setRescheduleForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>
          </div>
        ) : null}

        {scenario === "reject" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              客人名稱
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={rejectForm.customerName}
                onChange={(event) => setRejectForm((prev) => ({ ...prev, customerName: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              預約需求
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={rejectForm.requestDetail}
                onChange={(event) => setRejectForm((prev) => ({ ...prev, requestDetail: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700 md:col-span-2">
              拒絕原因
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={rejectForm.rejectReason}
                onChange={(event) => setRejectForm((prev) => ({ ...prev, rejectReason: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700 md:col-span-2">
              備註（可選）
              <textarea
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                rows={2}
                value={rejectForm.note}
                onChange={(event) => setRejectForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>
          </div>
        ) : null}

        <button
          type="button"
          className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          onClick={generateSandboxReply}
        >
          產生模擬回覆
        </button>

        {sandboxReply ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            {sandboxReply}
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
