"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const primaryNavItems = [
  { href: "/", label: "Dashboard" },
  { href: "/knowledge-base", label: "Knowledge Base" },
  { href: "/conversation-logs", label: "Conversation Logs" },
  { href: "/manual-reply-tasks", label: "人工回覆工作台" },
];

const legacyNavItems = [
  { href: "/appointment-requests", label: "Appointment Requests" },
  { href: "/abnormal-alerts", label: "Abnormal Alerts" },
];

export function PageShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold text-brand">寵物店 LINE AI 客服工作台</h1>
          <p className="text-sm text-slate-500">Sandbox only，預約與異常集中到人工回覆工作台</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border bg-white p-4">
          <nav className="space-y-2">
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">主要入口</p>
            {primaryNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  isItemActive(item.href) ? "bg-brand/10 font-medium text-brand" : "text-slate-700 hover:bg-slate-100"
                }`}
                aria-current={isItemActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4">
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">舊版 / 暫停使用</p>
              <p className="px-3 py-2 text-xs leading-5 text-slate-500">目前預約與異常都會集中到人工回覆工作台處理。</p>
              {legacyNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    isItemActive(item.href) ? "bg-slate-200 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-100"
                  }`}
                  aria-current={isItemActive(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </aside>

        <main className="space-y-4">
          <section className="rounded-lg border bg-white p-5">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}
