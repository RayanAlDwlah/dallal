import { NextResponse } from "next/server";

import { AiError, chatJSON } from "@/lib/ai/client";
import { aiConfig } from "@/lib/ai/config";
import { allow, clientKey } from "@/lib/ai/rate-limit";
import { fetchCategoryTree } from "@/lib/auctions/queries";
import { isMoneyString } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

/**
 * «يفهم البحث» — turns a natural Arabic query into visible, editable filters
 * (ai.html touchpoint 3). The chips ARE the result: the caller renders them
 * before anything runs, and every one can be removed.
 *
 * The model extracts, it never computes: a price only survives if it appears
 * as a plain amount string and re-validates against MONEY_RE. On any failure
 * the caller falls back to the plain keyword search unchanged.
 */

interface ParsedQuery {
  category: string | null;
  keywords: string[];
  max_price: string | null;
  ending_within_hours: number | null;
}

export async function POST(req: Request) {
  const cfg = aiConfig();
  if (!cfg) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  if (!allow(clientKey(req, "search"), 12, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let q = "";
  try {
    const body = (await req.json()) as { q?: unknown };
    q = typeof body.q === "string" ? body.q.trim().slice(0, 200) : "";
  } catch {
    /* fall through to the length check */
  }
  if (q.length < 4) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const supabase = await createClient();
  const categories = await fetchCategoryTree(supabase);
  const mainNames = categories.map((c) => c.name_ar);

  const schema = {
    type: "object",
    properties: {
      category: { type: ["string", "null"], enum: [...mainNames, null] },
      keywords: {
        type: "array",
        items: { type: "string" },
        description: "كلمات البحث الجوهرية فقط — الماركة، الموديل، السنة. بدون كلمات مثل «أبي» و«فوق» و«تحت».",
      },
      max_price: {
        type: ["string", "null"],
        description: "أعلى سعر ذكره المستخدم حرفيًا، رقمًا فقط مثل 60000. «60 ألف» تعني 60000. null إذا لم يذكر سعرًا.",
      },
      ending_within_hours: {
        type: ["integer", "null"],
        description: "24 إذا قال ينتهي اليوم أو خلال يوم، 1 إذا قال خلال ساعة. null إذا لم يذكر وقتًا.",
      },
    },
    required: ["category", "keywords", "max_price", "ending_within_hours"],
    additionalProperties: false,
  };

  try {
    const p = await chatJSON<ParsedQuery>(cfg, {
      system:
        "أنت محلّل بحث لمنصة مزادات سعودية. حوّل جملة المستخدم إلى فلاتر. " +
        "استخرج فقط ما قاله المستخدم فعلًا — لا تضف ولا تخمّن. التصنيفات المتاحة: " +
        mainNames.join("، ") +
        "\n\nأمثلة:\n" +
        '«أبي كامري 2020 تحت 60 ألف وينتهي اليوم» ← {"category":"سيارات ومركبات","keywords":["كامري","2020"],"max_price":"60000","ending_within_hours":24}\n' +
        '«ساعة رولكس أقل من 45000 ريال» ← {"category":"ساعات ومجوهرات","keywords":["رولكس"],"max_price":"45000","ending_within_hours":null}\n' +
        '«لوحة مميزة رقمين» ← {"category":"لوحات وأرقام مميزة","keywords":["رقمين"],"max_price":null,"ending_within_hours":null}\n' +
        "\nتذكّر: «X ألف» تعني X000. «ينتهي اليوم» تعني 24. «خلال ساعة» تعني 1.",
      user: q,
      schemaName: "search_filters",
      schema,
      temperature: 0,
    });

    const main = p.category ? (categories.find((c) => c.name_ar === p.category) ?? null) : null;
    const keywords = (p.keywords ?? [])
      .map((k) => k.trim())
      .filter((k) => k.length >= 2 && k.length <= 40)
      .slice(0, 4);
    const maxPrice = p.max_price && isMoneyString(p.max_price) ? p.max_price : null;
    const endingWithinHours =
      typeof p.ending_within_hours === "number" &&
      Number.isInteger(p.ending_within_hours) &&
      p.ending_within_hours >= 1 &&
      p.ending_within_hours <= 168
        ? p.ending_within_hours
        : null;

    return NextResponse.json({
      category: main ? { slug: main.slug, label: main.name_ar } : null,
      keywords,
      maxPrice,
      endingWithinHours,
    });
  } catch (e) {
    const status = e instanceof AiError ? e.status : 502;
    return NextResponse.json({ error: "ai_failed" }, { status });
  }
}
