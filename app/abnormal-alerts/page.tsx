import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { abnormalAlerts } from "@/lib/mockData";

export default function AbnormalAlertsPage() {
  return (
    <PageShell title="Abnormal Alerts 異常提醒" description="系統偵測到需要客服關注的異常事件。">
      <SimpleTable headers={["事件編號", "嚴重度", "標題", "觸發時間", "摘要"]}>
        {abnormalAlerts.map((alert) => (
          <tr key={alert.id}>
            <td className="px-4 py-3">{alert.id}</td>
            <td className="px-4 py-3">
              <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-700">{alert.severity}</span>
            </td>
            <td className="px-4 py-3">{alert.title}</td>
            <td className="px-4 py-3">{alert.triggeredAt}</td>
            <td className="px-4 py-3">{alert.summary}</td>
          </tr>
        ))}
      </SimpleTable>
    </PageShell>
  );
}
