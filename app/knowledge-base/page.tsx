"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { kbArticles as mockKbArticles } from "@/lib/mockData";
import {
  deleteKnowledgeArticle,
  fetchKnowledgeArticles,
  insertKnowledgeArticle,
  isSupabaseConfigured,
  supabaseEnvWarning,
  updateKnowledgeArticle,
} from "@/lib/supabaseClient";
import { KbArticle } from "@/lib/types";
import {
  clearSandboxKnowledgeGapEvents,
  listSandboxKnowledgeGapEvents,
  markSandboxKnowledgeGapEventAdded,
  markSandboxKnowledgeGapEventIgnored,
  SandboxKnowledgeGapEvent,
} from "@/lib/sandboxKnowledgeGapEvents";

const initialForm = { title: "", category: "", content: "" };

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<KbArticle[]>(mockKbArticles);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);
  const [gapEvents, setGapEvents] = useState<SandboxKnowledgeGapEvent[]>([]);

  useEffect(() => {
    async function loadArticles() {
      if (!isSupabaseConfigured) return;

      try {
        const data = await fetchKnowledgeArticles<KbArticle[]>();
        setArticles(data);
        setNotice("");
      } catch (error) {
        setNotice(`Supabase 讀取失敗，已使用 mock data。${(error as Error).message}`);
      }
    }

    loadArticles();
  }, []);
  useEffect(() => {
    setGapEvents(listSandboxKnowledgeGapEvents());
  }, []);

  const submitLabel = useMemo(() => (editingId ? "更新知識" : "新增知識"), [editingId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      title: form.title,
      category: form.category,
      content: form.content,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured) {
      const localRecord: KbArticle = {
        id: editingId ?? `KB-${String(articles.length + 1).padStart(3, "0")}`,
        ...payload,
      };

      setArticles((prev) => {
        if (!editingId) return [localRecord, ...prev];
        return prev.map((item) => (item.id === editingId ? { ...item, ...payload } : item));
      });
      setForm(initialForm);
      setEditingId(null);
      setNotice(supabaseEnvWarning);
      return;
    }

    try {
      if (!editingId) {
        const inserted = await insertKnowledgeArticle<KbArticle[]>(payload);
        setArticles((prev) => [...inserted, ...prev]);
      } else {
        const updated = await updateKnowledgeArticle<KbArticle[]>(editingId, payload);
        setArticles((prev) => prev.map((item) => (item.id === editingId ? updated[0] : item)));
      }

      setForm(initialForm);
      setEditingId(null);
      setNotice("");
    } catch (error) {
      setNotice(`儲存失敗：${(error as Error).message}`);
    }
  }

  async function toggleActive(article: KbArticle) {
    const next = !article.is_active;

    if (!isSupabaseConfigured) {
      setArticles((prev) => prev.map((item) => (item.id === article.id ? { ...item, is_active: next } : item)));
      setNotice(supabaseEnvWarning);
      return;
    }

    try {
      const updated = await updateKnowledgeArticle<KbArticle[]>(article.id, { is_active: next, updated_at: new Date().toISOString() });
      setArticles((prev) => prev.map((item) => (item.id === article.id ? updated[0] : item)));
    } catch (error) {
      setNotice(`更新狀態失敗：${(error as Error).message}`);
    }
  }

  function startEdit(article: KbArticle) {
    setEditingId(article.id);
    setForm({ title: article.title, category: article.category, content: article.content ?? "" });
  }

  async function deleteArticle(article: KbArticle) {
    const shouldDelete = window.confirm("確定要刪除這筆知識嗎？此操作無法復原。");
    if (!shouldDelete) return;

    if (!isSupabaseConfigured) {
      setArticles((prev) => prev.filter((item) => item.id !== article.id));
      setNotice(supabaseEnvWarning);
      return;
    }

    try {
      await deleteKnowledgeArticle<KbArticle[]>(article.id);
      setArticles((prev) => prev.filter((item) => item.id !== article.id));
      setNotice("已刪除知識。");
    } catch (error) {
      setNotice(`刪除失敗：${(error as Error).message}`);
    }
  }

  function refreshGapEvents() {
    setGapEvents(listSandboxKnowledgeGapEvents());
  }

  return (
    <PageShell title="Knowledge Base" description="價格、規則、服務內容、住宿須知、營業時間與包月規則都從這裡維護">
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        Knowledge Base 是自動回覆的唯一依據；不要把價格或店家規則寫死在程式碼。
      </p>
      <section className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-emerald-900">Sandbox 知識庫補充建議</h3>
          <button className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs" type="button" onClick={() => { clearSandboxKnowledgeGapEvents(); refreshGapEvents(); }}>
            清除全部補充建議
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {gapEvents.length === 0 ? <p className="text-sm text-slate-600">目前沒有補充建議。</p> : null}
          {gapEvents.map((event) => (
            <div key={event.id} className="rounded border border-emerald-200 bg-white p-3 text-sm">
              <p><span className="font-medium">建議標題：</span>{event.suggested_title}</p>
              <p><span className="font-medium">建議分類：</span>{event.suggested_category}</p>
              <p><span className="font-medium">代表問題：</span>{event.representative_message}</p>
              <p><span className="font-medium">出現次數：</span>{event.count}</p>
              <p><span className="font-medium">最後出現：</span>{event.last_seen_at}</p>
              <p><span className="font-medium">reason：</span>{event.reason}</p>
              <p><span className="font-medium">status：</span>{event.status}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setForm({ title: event.suggested_title, category: event.suggested_category, content: `請補充此問題的標準回覆：${event.representative_message}` })}>複製為新增知識草稿</button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => { markSandboxKnowledgeGapEventAdded(event.id); refreshGapEvents(); }}>標記已補充</button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => { markSandboxKnowledgeGapEventIgnored(event.id); refreshGapEvents(); }}>忽略</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <form className="mb-4 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-4" onSubmit={handleSubmit}>
        <input
          className="rounded border px-2 py-1 text-sm"
          placeholder="標題"
          required
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
        />
        <input
          className="rounded border px-2 py-1 text-sm"
          placeholder="分類"
          required
          value={form.category}
          onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
        />
        <input
          className="rounded border px-2 py-1 text-sm"
          placeholder="內容摘要"
          value={form.content}
          onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
        />
        <div className="flex gap-2">
          <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white" type="submit">
            {submitLabel}
          </button>
          {editingId ? (
            <button
              className="rounded border border-slate-300 px-3 py-1 text-sm"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(initialForm);
              }}
            >
              取消編輯
            </button>
          ) : null}
        </div>
      </form>

      <SimpleTable headers={["文章編號", "標題", "分類", "更新日期", "狀態", "操作"]}>
        {articles.map((article) => (
          <tr key={article.id}>
            <td className="px-4 py-3">{article.id}</td>
            <td className="px-4 py-3">{article.title}</td>
            <td className="px-4 py-3">{article.category}</td>
            <td className="px-4 py-3">{article.updated_at?.slice(0, 10) ?? "-"}</td>
            <td className="px-4 py-3">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{article.is_active ? "active" : "inactive"}</span>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <button className="rounded border px-2 py-1 text-xs" onClick={() => startEdit(article)} type="button">
                  編輯
                </button>
                <button className="rounded border px-2 py-1 text-xs" onClick={() => toggleActive(article)} type="button">
                  {article.is_active ? "停用" : "啟用"}
                </button>
                <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => deleteArticle(article)} type="button">
                  刪除
                </button>
              </div>
            </td>
          </tr>
        ))}
      </SimpleTable>
    </PageShell>
  );
}
