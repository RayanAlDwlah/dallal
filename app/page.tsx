/**
 * Placeholder home route.
 *
 * S0-07 delivers a runnable scaffold only. This page exists so the
 * application has an entry point and nothing more — it is NOT the auction
 * listing. The real listing is AUC-09 (FR-LIST-05: active auctions only,
 * soonest ending first) and replaces this file.
 *
 * No auction, bidding or authentication behaviour is implemented here.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-5 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">دلال</h1>
        <p className="text-md text-ink-2">منصة المزادات المباشرة</p>
      </div>

      <div className="border-rule bg-surface shadow-e1 flex flex-col gap-3 rounded-lg border p-5">
        <h2 className="text-base font-semibold">الهيكل الأساسي جاهز</h2>
        <p className="text-sm text-ink-2">
          هذه صفحة مؤقتة تثبت أن التطبيق يعمل. لم تُنفَّذ أي ميزة بعد — لا
          مزادات، ولا مزايدة، ولا مصادقة.
        </p>
        <p className="text-sm text-ink-3">
          قائمة المزادات تحل مكان هذه الصفحة في <span className="num">AUC-09</span>.
        </p>
      </div>
    </main>
  );
}
