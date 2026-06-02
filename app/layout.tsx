import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "寵物店 LINE AI 客服工作台",
  description: "Knowledge Base、Conversation Logs 與人工回覆工作台 sandbox MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
