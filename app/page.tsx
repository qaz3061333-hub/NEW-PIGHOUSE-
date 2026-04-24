"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { abnormalAlerts, appointmentRequests, conversationLogs, manualReplyTasks } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";

type DashboardStats = {
  appointments: number;
  alerts: number;
  manualReplies: number;
  conversations: number;
};

const fallbackStats: DashboardStats = {
  appointments: appointmentRequests.length,
  alerts: abnormalAlerts.length,
  manualReplies: manualReplyTasks.length,
  conversations: conversationLogs.length,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(fallbackStats);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) return;

      try {
        const [appointments, alerts, manualReplies, conversations] = await Promise.all([
          supabaseRequest<unknown[]>({ table: "appointment_requests", query: "select=id" }),
          supabaseRequest<unknown[]>({ table: "abnormal_alerts", query: "select=id" }),
          supabaseRequest<unknown[]>({ table: "manual_reply_tasks", query: "select=id" }),
          supabaseRequest<unknown[]>({ table: "messages", query: "select=id" }),
        ]);

        setStats({
          appointments: appointments.length,
          alerts: alerts.length,
          manualReplies: manualReplies.length,
          conversations: conversations.length,
        });
      } catch (error) {
        setNotice(`Supabase 讀取失敗，已使用 mock data。${(error as Error).message}`);
      }
    }

    load();
  }, []);

  return (
    <PageShell title="Dashboard" description="客服後台總覽">
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="今日預約申請" value={String(stats.appointments)} hint="含新申請與處理中" />
        <StatCard label="異常提醒" value={String(stats.alerts)} hint="需優先檢查" />
        <StatCard label="人工回覆待辦" value={String(stats.manualReplies)} hint="建議 15 分鐘內處理" />
        <StatCard label="近期對話數" value={String(stats.conversations)} hint="最近 24 小時" />
      </section>
    </PageShell>
  );
}
