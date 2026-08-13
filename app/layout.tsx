import type { Metadata, Viewport } from "next";

import { SiteHeader } from "@/components/layout/site-header";
import { getViewer } from "@/lib/auth/identity";

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
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /*
   * Read here rather than in the header itself so the signed-in state is
   * present in the first server render — FR-AUTH-15 asks every page to state
   * it, and a client-side read would show every page as signed-out for a beat
   * before correcting itself.
   *
   * Reading cookies in the root layout makes every route render per request.
   * That is the intended trade: this is a live auction product where the
   * listing, prices and countdowns are request-time data anyway.
   */
  const viewer = await getViewer();

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${ui.variable} ${num.variable} bg-ground text-ink font-ui flex min-h-screen flex-col antialiased`}
      >
        {/*
          Skip link — the first tab stop, so a keyboard user is not forced
          through the whole navigation on every page (NFR-USA-08).
        */}
        <a
          href="#main"
          className="bg-brand text-on-brand sr-only rounded-md px-4 py-2 font-semibold focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50"
        >
          تخطَّ إلى المحتوى
        </a>

        <SiteHeader viewer={viewer} />

        <div id="main" className="flex-1">
          {children}
        </div>

        <footer className="border-rule text-ink-3 mt-8 border-t py-6 text-center text-xs">
          <p>
            دلال — منصة عرض للمزادات. الأسعار بالريال السعودي وهي قيم تجريبية
            محاكاة، ولا تُجرى أي عمليات دفع.
          </p>
        </footer>
      </body>
    </html>
  );
}
