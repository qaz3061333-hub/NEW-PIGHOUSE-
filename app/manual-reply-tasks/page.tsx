import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { manualReplyTasks } from "@/lib/mockData";

export default function ManualReplyTasksPage() {
  return (
    <PageShell title="Manual Reply Tasks 需人工回覆" description="無法自動回覆、需客服介入的對話任務。">
      <SimpleTable headers={["任務編號", "客戶", "主題", "等待時間（分鐘）", "優先度"]}>
        {manualReplyTasks.map((task) => (
          <tr key={task.id}>
            <td className="px-4 py-3">{task.id}</td>
            <td className="px-4 py-3">{task.customer}</td>
            <td className="px-4 py-3">{task.topic}</td>
            <td className="px-4 py-3">{task.waitingMinutes}</td>
            <td className="px-4 py-3">
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">{task.priority}</span>
            </td>
          </tr>
        ))}
      </SimpleTable>
    </PageShell>
  );
}
