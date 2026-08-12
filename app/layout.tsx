import type { Metadata, Viewport } from "next";

import { num, ui } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "دلال — منصة المزادات المباشرة",
  description:
    "منصة مزادات مباشرة: أنشئ مزادًا، تابع المزايدات لحظة بلحظة، واعرف الفائز عند انتهاء الوقت.",
};

/**
 * NFR-USA-06 — the interface must be fully usable in a mobile browser at
 * 375px. Dalal is a responsive web application, not a native app (PRD §1.1).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * design/STACK.md §4.1 — lang and dir are set here, once, and never
 * overridden anywhere else in the application.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${ui.variable} ${num.variable} bg-ground text-ink font-ui antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
