"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { conversationLogs as mockConversationLogs } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { ConversationLog } from "@/lib/types";

export default function ConversationLogsPage() {
  const [logs, setLogs] = useState<ConversationLog[]>(mockConversationLogs);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);

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
    </PageShell>
  );
}
