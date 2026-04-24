import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { abnormalAlerts, appointmentRequests, conversationLogs, manualReplyTasks } from "@/lib/mockData";

export default function DashboardPage() {
  return (
    <PageShell title="Dashboard" description="客服後台總覽（mock data）">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="今日預約申請" value={String(appointmentRequests.length)} hint="含新申請與處理中" />
        <StatCard label="異常提醒" value={String(abnormalAlerts.length)} hint="需優先檢查" />
        <StatCard label="人工回覆待辦" value={String(manualReplyTasks.length)} hint="建議 15 分鐘內處理" />
        <StatCard label="近期對話數" value={String(conversationLogs.length)} hint="最近 24 小時" />
      </section>
    </PageShell>
  );
}
