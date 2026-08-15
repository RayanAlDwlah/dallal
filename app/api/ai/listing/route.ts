import { NextResponse } from "next/server";

import { AiError, chatJSON } from "@/lib/ai/client";
import { aiConfig } from "@/lib/ai/config";
import { allow, clientKey } from "@/lib/ai/rate-limit";
import { fetchCategoryTree } from "@/lib/auctions/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * «دلال يكتب لك» — reads the seller's photos and suggests a title, a
 * description, a category and attribute values. Fills editable fields and
 * nothing else: it never publishes, and the seller edits or rejects
 * (ai.html touchpoint 1, «أنت تعدّل أو ترفض»).
 *
 * What reaches the model: the images the seller just chose and the public
 * category names. No email, no internal id, no viewer identity — §6.
 */

const MAX_IMAGES = 3;
const MAX_IMAGE_CHARS = 4_000_000; // ~3 MB of base64 per image

interface Suggestion {
  title: string;
  description: string;
  category: string;
  attributes: Array<{ field: string; value: string }>;
}

export async function POST(req: Request) {
  const cfg = aiConfig();
  if (!cfg) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  if (!allow(clientKey(req, "listing"), 6, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { images?: unknown; hint?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const images = Array.isArray(body.images)
    ? body.images.filter(
        (i): i is string =>
          typeof i === "string" &&
          /^data:image\/(jpeg|png|webp);base64,/.test(i) &&
          i.length <= MAX_IMAGE_CHARS,
      )
    : [];
  if (images.length === 0) return NextResponse.json({ error: "images_required" }, { status: 400 });
  const hint = typeof body.hint === "string" ? body.hint.slice(0, 200) : "";

  const categories = await fetchCategoryTree(supabase);
  /* Enum values are the Arabic names — the model classifies against what the
     user actually sees, and Arabic enums are what a local model gets right. */
  const mainNames = categories.map((c) => c.name_ar);
  const catalogue = categories
    .map((c) => `${c.name_ar}${c.children.length ? `: ${c.children.map((s) => s.name_ar).join("، ")}` : ""}`)
    .join("\n");

  const schema = {
    type: "object",
    properties: {
      title: { type: "string", description: "اسم المنتج، 3 إلى 120 محرفًا، بالعربية" },
      description: {
        type: "string",
        description: "وصف صادق من 30 إلى 600 محرف: الحالة، الملحقات، وما يهم المزايد. لا تخترع شيئًا لا يظهر في الصور.",
      },
      category: { type: "string", enum: mainNames },
      attributes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string" },
            value: { type: "string" },
          },
          required: ["field", "value"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "description", "category", "attributes"],
    additionalProperties: false,
  };

  try {
    const s = await chatJSON<Suggestion>(cfg, {
      system:
        "أنت مساعد بائع في منصة مزادات سعودية. تكتب عنوانًا ووصفًا عربيًا واضحًا من صور المنتج. " +
        "لا تخترع مواصفات لا تظهر في الصور، ولا تذكر أي سعر إطلاقًا — السعر ليس شغلك. " +
        "التصنيفات المتاحة:\n" +
        catalogue,
      user: hint ? `اكتب إعلان هذا المنتج. تلميح من البائع: ${hint}` : "اكتب إعلان هذا المنتج من الصور.",
      images,
      schemaName: "listing_suggestion",
      schema,
    });

    /* Resolve the Arabic category name server-side; attribute labels must be
       ones the chosen category actually defines. */
    const main = categories.find((c) => c.name_ar === s.category) ?? null;
    const fields = main?.fields ?? [];
    const attributes = Object.fromEntries(
      (s.attributes ?? [])
        .filter((a) => fields.includes(a.field) && a.value.trim() !== "")
        .map((a) => [a.field, a.value.trim().slice(0, 120)]),
    );

    return NextResponse.json({
      title: s.title.trim().slice(0, 120),
      description: s.description.trim().slice(0, 2000),
      category: main ? { id: main.id, label: main.name_ar } : null,
      attributes,
    });
  } catch (e) {
    const status = e instanceof AiError ? e.status : 502;
    return NextResponse.json({ error: "ai_failed" }, { status });
  }
}
