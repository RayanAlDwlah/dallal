import type { Metadata, Viewport } from "next";

import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource/rubik/500.css";
import "@fontsource/rubik/600.css";
import "@fontsource/rubik/700.css";
import "./globals.css";

import { Topbar } from "@/components/navigation/topbar";

export const metadata: Metadata = {
  title: {
    default: "دلال — مزادات مباشرة",
    template: "%s — دلال",
  },
  description:
    "دلال: منصة مزادات مباشرة بالعربية. زايد لحظيًا على سيارات وعقارات وساعات ولوحات مميزة — أعلى مزايد يفوز.",
};

export const viewport: Viewport = {
  themeColor: "#07090D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  /* lang/dir are set ONCE here and never overridden per component. */
  return (
    <html lang="ar" dir="rtl">
      <body>
        <Topbar />
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-20 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
