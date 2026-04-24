import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pet Care CS Backend MVP",
  description: "LINE 官方帳號客服後台 MVP（mock data）",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
