"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { manualReplyTasks as mockManualReplyTasks } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { ManualReplyTask } from "@/lib/types";
import { listSandboxManualReplyTaskEvents, SandboxManualReplyTaskEvent } from "@/lib/sandboxManualReplyTaskEvents";
import { inferSandboxManualTaskTypeFromText } from "@/lib/sandboxCustomerServiceTriage";

type DashboardStats = {
  pendingManualTasks: number;
  appointmentAvailability: number;
  complaintRefund: number;
  highRisk: number;
  kbOrUncertain: number;
};

function taskText(task: ManualReplyTask) {
  return `${task.topic || ""} ${task.last_message || ""} ${task.reply_note || ""}`;
}

function computeStats(tasks: ManualReplyTask[], sandboxTasks: SandboxManualReplyTaskEvent[]): DashboardStats {
  const openLegacyTasks = tasks.filter((task) => !task.is_replied);
  const openSandboxTasks = sandboxTasks.filter((task) => !task.is_replied);
  const allOpenTypes = [
    ...openLegacyTasks.map((task) => inferSandboxManualTaskTypeFromText(taskText(task))),
    ...openSandboxTasks.map((task) => task.task_type || inferSandboxManualTaskTypeFromText(`${task.topic} ${task.last_message} ${task.reply_note}`)),
  ];

  return {
    pendingManualTasks: openLegacyTasks.length + openSandboxTasks.length,
    appointmentAvailability: allOpenTypes.filter((type) => type === "appointment_availability").length,
    complaintRefund: allOpenTypes.filter((type) => type === "complaint_refund" || type === "complaint" || type === "refund").length,
    highRisk: allOpenTypes.filter((type) => type === "high_risk").length,
    kbOrUncertain: allOpenTypes.filter((type) => type === "kb_not_found" || type === "ai_uncertain").length,
  };
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<ManualReplyTask[]>(mockManualReplyTasks);
  const [sandboxTasks, setSandboxTasks] = useState<SandboxManualReplyTaskEvent[]>([]);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);

  useEffect(() => {
    setSandboxTasks(listSandboxManualReplyTaskEvents());

    async function load() {
      if (!isSupabaseConfigured) return;

      try {
        const manualReplies = await supabaseRequest<ManualReplyTask[]>({
          table: "manual_reply_tasks",
          query: "select=*&order=waiting_minutes.desc",
        });

        setTasks(manualReplies);
        setNotice("");
      } catch (error) {
        setNotice(`Supabase 讀取失敗，目前顯示 mock data：${(error as Error).message}`);
      }
    }

    load();
  }, []);

  const stats = useMemo(() => computeStats(tasks, sandboxTasks), [tasks, sandboxTasks]);

  return (
    <PageShell title="Dashboard" description="主流程概覽：預約與異常都集中到人工回覆工作台">
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="今天待處理人工任務" value={String(stats.pendingManualTasks)} hint="包含 sandbox 與既有 manual_reply_tasks" />
        <StatCard label="預約 / 問空檔" value={String(stats.appointmentAvailability)} hint="先由人工確認，不自動成立預約" />
        <StatCard label="客訴 / 退款" value={String(stats.complaintRefund)} hint="高優先度人工處理" />
        <StatCard label="異常 / 高風險" value={String(stats.highRisk)} hint="不做醫療判斷，先轉門市" />
        <StatCard label="KB 找不到 / AI 不確定" value={String(stats.kbOrUncertain)} hint="補 KB 或人工確認" />
      </section>
    </PageShell>
  );
}
