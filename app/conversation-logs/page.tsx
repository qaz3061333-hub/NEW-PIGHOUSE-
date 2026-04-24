import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { conversationLogs } from "@/lib/mockData";

export default function ConversationLogsPage() {
  return (
    <PageShell title="Conversation Logs 對話紀錄" description="客服與顧客歷史對話摘要。">
      <SimpleTable headers={["對話編號", "客戶", "來源", "最後訊息", "更新時間"]}>
        {conversationLogs.map((log) => (
          <tr key={log.id}>
            <td className="px-4 py-3">{log.id}</td>
            <td className="px-4 py-3">{log.customer}</td>
            <td className="px-4 py-3">{log.channel}</td>
            <td className="px-4 py-3">{log.lastMessage}</td>
            <td className="px-4 py-3">{log.updatedAt}</td>
          </tr>
        ))}
      </SimpleTable>
    </PageShell>
  );
}
