"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { kbArticles as mockKbArticles } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { KbArticle } from "@/lib/types";

const initialForm = { title: "", category: "", content: "" };

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<KbArticle[]>(mockKbArticles);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);

  useEffect(() => {
    async function loadArticles() {
      if (!isSupabaseConfigured) return;

      try {
        const data = await supabaseRequest<KbArticle[]>({
          table: "knowledge_articles",
          query: "select=*&order=updated_at.desc",
        });
        setArticles(data);
        setNotice("");
      } catch (error) {
        setNotice(`Supabase 讀取失敗，已使用 mock data。${(error as Error).message}`);
      }
    }

    loadArticles();
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
        const inserted = await supabaseRequest<KbArticle[]>({
          table: "knowledge_articles",
          method: "POST",
          body: payload,
          prefer: "return=representation",
        });
        setArticles((prev) => [...inserted, ...prev]);
      } else {
        const updated = await supabaseRequest<KbArticle[]>({
          table: "knowledge_articles",
          method: "PATCH",
          query: `id=eq.${encodeURIComponent(editingId)}`,
          body: payload,
          prefer: "return=representation",
        });
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
      const updated = await supabaseRequest<KbArticle[]>({
        table: "knowledge_articles",
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(article.id)}`,
        body: { is_active: next, updated_at: new Date().toISOString() },
        prefer: "return=representation",
      });
      setArticles((prev) => prev.map((item) => (item.id === article.id ? updated[0] : item)));
    } catch (error) {
      setNotice(`更新狀態失敗：${(error as Error).message}`);
    }
  }

  function startEdit(article: KbArticle) {
    setEditingId(article.id);
    setForm({ title: article.title, category: article.category, content: article.content ?? "" });
  }

  return (
    <PageShell title="Knowledge Base 知識庫管理" description="管理客服可引用的標準回覆與作業 SOP。">
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}

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
              </div>
            </td>
          </tr>
        ))}
      </SimpleTable>
    </PageShell>
  );
}
