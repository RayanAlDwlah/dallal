import { NextResponse } from "next/server";

import { AiError, chatJSON } from "@/lib/ai/client";
import { aiConfig } from "@/lib/ai/config";
import { allow, clientKey } from "@/lib/ai/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * «استيراد CSV» fallback — when a dealership file's headers match none of the
 * client-side heuristics, الشريطي maps COLUMN NAMES to our fields. Mapping
 * only: every value still comes from the host's file and is re-validated by
 * the client (money via parseMoneyInput, increments as multiples of 10). The
 * model never invents a lot and never produces an amount.
 */

interface Mapping {
  title: number | null;
  price: number | null;
  increment: number | null;
  duration: number | null;
  category: number | null;
}

export async function POST(req: Request) {
  const cfg = aiConfig();
  if (!cfg) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  if (!allow(clientKey(req, "csv-map"), 6, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let headers: string[] = [];
  let samples: string[][] = [];
  try {
    const body = (await req.json()) as { headers?: unknown; samples?: unknown };
    headers = Array.isArray(body.headers)
      ? body.headers.filter((h): h is string => typeof h === "string").slice(0, 30)
      : [];
    samples = Array.isArray(body.samples)
      ? body.samples
          .slice(0, 3)
          .map((r) => (Array.isArray(r) ? r.map((c) => String(c).slice(0, 60)) : []))
      : [];
  } catch {
    /* fall through */
  }
  if (headers.length === 0) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const columnIndex = { type: ["integer", "null"], minimum: 0, maximum: headers.length - 1 };
  const schema = {
    type: "object",
    properties: {
      title: columnIndex,
      price: columnIndex,
      increment: columnIndex,
      duration: columnIndex,
      category: columnIndex,
    },
    required: ["title", "price", "increment", "duration", "category"],
    additionalProperties: false,
  };

  try {
    const m = await chatJSON<Mapping>(cfg, {
      system:
        "أنت تربط أعمدة ملف CSV من معرض بحقول منصة مزادات. أعد رقم العمود (يبدأ من 0) لكل حقل، " +
        "أو null إذا ما فيه عمود مناسب. title=اسم القطعة، price=سعر البداية، increment=مقدار الزيادة، " +
        "duration=المدة بالدقائق، category=التصنيف. لا تخمّن — null أفضل من ربط غلط.",
      user:
        `الأعمدة: ${headers.map((h, i) => `${i}:${h}`).join(" | ")}\n` +
        (samples.length ? `أمثلة صفوف:\n${samples.map((r) => r.join(" | ")).join("\n")}` : ""),
      schemaName: "csv_mapping",
      schema,
      temperature: 0,
    });
    const clamp = (v: number | null) =>
      typeof v === "number" && v >= 0 && v < headers.length ? v : null;
    return NextResponse.json({
      title: clamp(m.title),
      price: clamp(m.price),
      increment: clamp(m.increment),
      duration: clamp(m.duration),
      category: clamp(m.category),
    });
  } catch (e) {
    const status = e instanceof AiError ? e.status : 502;
    return NextResponse.json({ error: "ai_failed" }, { status });
  }
}
