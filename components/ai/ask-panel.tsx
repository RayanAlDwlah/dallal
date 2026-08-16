"use client";

import { useState } from "react";

import { Sparkle } from "@/components/ai/sparkle";

interface QA {
  q: string;
  known: boolean;
  answer: string;
  evidence: string | null;
}

/**
 * «اسأل عن القطعة» — the auction page Q&A (ai.html touchpoint 4). Answers
 * come from the seller's own text only; the honest exit is «ما أعرف». The
 * disclaimer line is part of the design, not decoration: generated answers
 * are not the seller's words and carry no guarantee.
 */
export function AskPanel({ auctionId }: { auctionId: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<QA[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  if (gone) return null;

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (question.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ auctionId, question }),
      });
      if (res.status === 503) {
        setGone(true); // not configured — the panel disappears, the page stays.
        return;
      }
      if (res.status === 429) {
        setError("أسئلة كثيرة ورا بعض — جرّب بعد دقيقة.");
        return;
      }
      if (!res.ok) throw new Error();
      const a = (await res.json()) as Omit<QA, "q">;
      setItems((prev) => [...prev, { q: question, ...a }]);
      setQ("");
    } catch {
      setError("ما قدرنا نجاوب الحين — جرّب بعد شوي.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="hairline mt-4 rounded-[20px] bg-surface p-5 sm:p-6">
      <h2 className="m-0 mb-1 flex items-center gap-2.5 text-[13px] font-medium text-ink3">
        <Sparkle className="size-[22px]" />
        اسأل عن القطعة
      </h2>
      <p className="m-0 mb-4 text-[12.5px] text-ink3">
        يجاوب من وصف البائع فقط. ما يعرف؟ يقول ما أعرف — واسأل البائع قبل ما تدفع على شيء غير
        مذكور.
      </p>

      {items.map((item, i) => (
        <div key={i} className={i > 0 ? "mt-4 border-t border-[var(--color-hair)] pt-4" : ""}>
          <div className="mb-3 flex items-start gap-2.5">
            <span className="hairline grid size-7 flex-none place-items-center rounded-full bg-raised text-[12px] text-ink2">
              أنت
            </span>
            <p className="m-0 pt-0.5 text-[14.5px]">{item.q}</p>
          </div>
          <div className="flex items-start gap-2.5">
            <Sparkle />
            <div className="min-w-0 pt-0.5">
              <p className={`m-0 text-[14.5px] ${item.known ? "" : "text-ink2"}`}>{item.answer}</p>
              {item.evidence ? (
                <p className="m-0 mt-2 border-s-2 border-[rgba(124,58,237,.5)] ps-2.5 text-[12.5px] text-ink3">
                  من وصف البائع: «{item.evidence}»
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      <form onSubmit={ask} className={`flex gap-2 ${items.length > 0 ? "mt-4" : ""}`}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={300}
          placeholder="مثال: معها العلبة والأوراق؟"
          className="field h-11 flex-1"
        />
        <button
          type="submit"
          disabled={busy || q.trim().length < 3}
          className="h-11 cursor-pointer rounded-[11px] border-0 bg-[rgba(124,58,237,.85)] px-5 text-[13.5px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "يقرأ…" : "اسأل"}
        </button>
      </form>

      {error ? <p className="m-0 mt-2.5 text-[12.5px] text-[#FFB3BB]">{error}</p> : null}

      <p className="m-0 mt-4 border-t border-[var(--color-hair)] pt-3 text-[12px] text-ink3">
        الإجابات من وصف البائع ومواصفاته فقط، ومولّدة آليًا — ما هي كلام البائع ولا ضمان منه.
      </p>
    </section>
  );
}
