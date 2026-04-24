import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { kbArticles } from "@/lib/mockData";

export default function KnowledgeBasePage() {
  return (
    <PageShell title="Knowledge Base 知識庫管理" description="管理客服可引用的標準回覆與作業 SOP。">
      <SimpleTable headers={["文章編號", "標題", "分類", "更新日期", "狀態"]}>
        {kbArticles.map((article) => (
          <tr key={article.id}>
            <td className="px-4 py-3">{article.id}</td>
            <td className="px-4 py-3">{article.title}</td>
            <td className="px-4 py-3">{article.category}</td>
            <td className="px-4 py-3">{article.updatedAt}</td>
            <td className="px-4 py-3">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{article.status}</span>
            </td>
          </tr>
        ))}
      </SimpleTable>
    </PageShell>
  );
}
