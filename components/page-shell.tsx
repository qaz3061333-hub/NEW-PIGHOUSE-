import Link from "next/link";
import { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/knowledge-base", label: "Knowledge Base" },
  { href: "/appointment-requests", label: "Appointment Requests" },
  { href: "/abnormal-alerts", label: "Abnormal Alerts" },
  { href: "/manual-reply-tasks", label: "Manual Reply Tasks" },
  { href: "/conversation-logs", label: "Conversation Logs" },
];

export function PageShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold text-brand">Pet Care CS Backend MVP</h1>
          <p className="text-sm text-slate-500">Next.js + TS + Supabase Ready</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border bg-white p-4">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="space-y-4">
          <section className="rounded-xl border bg-white p-5">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}
