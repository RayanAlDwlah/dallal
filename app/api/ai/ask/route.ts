import { NextResponse } from "next/server";

import { AiError, chatJSON } from "@/lib/ai/client";
import { aiConfig } from "@/lib/ai/config";
import { allow, clientKey } from "@/lib/ai/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * «يجاوب عن القطعة» — answers ONLY from what the seller wrote (ai.html
 * touchpoint 4). «ما أعرف» is a designed, easy exit — a wrong «إي أصلية»
 * about a 40k watch shifts a responsibility the model does not own.
 *
 * The model sees: title, description, attributes, category name. It never
 * sees an email, an internal id, a bid, or who is asking — §6 and the
 * boundary list in ai.html.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Answer {
  known: boolean;
  answer: string;
  evidence: string | null;
}

export async function POST(req: Request) {
  const cfg = aiConfig();
  if (!cfg) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  if (!allow(clientKey(req, "ask"), 10, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let auctionId = "";
  let question = "";
  try {
    const body = (await req.json()) as { auctionId?: unknown; question?: unknown };
    auctionId = typeof body.auctionId === "string" ? body.auctionId : "";
    question = typeof body.question === "string" ? body.question.trim().slice(0, 300) : "";
  } catch {
    /* fall through */
  }
  if (!UUID_RE.test(auctionId) || question.length < 3) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auction } = await supabase
    .from("auctions")
    .select("title, description, attributes, status, category:categories(name_ar)")
    .eq("id", auctionId)
    .in("status", ["active", "ended"])
    .maybeSingle();
  if (!auction) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const attrs = Object.entries((auction.attributes as Record<string, string>) ?? {})
    .filter(([, v]) => typeof v === "string" && v.trim() !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const categoryName =
    (auction.category as unknown as { name_ar: string } | null)?.name_ar ?? "";

  const schema = {
    type: "object",
    properties: {
      known: {
        type: "boolean",
        description: "true فقط إذا كانت الإجابة موجودة نصًا في وصف البائع أو مواصفاته.",
      },
      answer: { type: "string", description: "الإجابة بالعربية. إذا known=false فابدأ بـ «ما أعرف»." },
      evidence: {
        type: ["string", "null"],
        description: "اقتباس حرفي قصير من الوصف أو المواصفات يدعم الإجابة. null إذا known=false.",
      },
    },
    required: ["known", "answer", "evidence"],
    additionalProperties: false,
  };

  try {
    const a = await chatJSON<Answer>(cfg, {
      system:
        "أنت مساعد يجيب عن أسئلة المزايدين عن قطعة معروضة في مزاد. " +
        "مصدرك الوحيد هو نص البائع أدناه. ما ليس مكتوبًا فيه لا تعرفه — قل «ما أعرف» بلا تردد ولا تخمّن أبدًا، " +
        "فالمزايد يدفع مالًا بناءً على كلامك. لا تذكر أسعارًا ولا تنصح بالمزايدة أو عدمها.",
      user:
        `التصنيف: ${categoryName}\nالعنوان: ${auction.title}\n\nوصف البائع:\n${auction.description}\n\n` +
        (attrs ? `المواصفات:\n${attrs}\n\n` : "") +
        `سؤال المزايد: ${question}`,
      schemaName: "item_answer",
      schema,
    });

    return NextResponse.json({
      known: a.known,
      answer: a.answer.trim().slice(0, 600),
      evidence: a.known && a.evidence ? a.evidence.trim().slice(0, 240) : null,
    });
  } catch (e) {
    const status = e instanceof AiError ? e.status : 502;
    return NextResponse.json({ error: "ai_failed" }, { status });
  }
}
