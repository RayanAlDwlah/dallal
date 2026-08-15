import { NextResponse } from "next/server";

import { aiConfig } from "@/lib/ai/config";
import { pingModel } from "@/lib/ai/client";

/**
 * «اختبر الاتصال» — reports whether the assistive layer is configured and
 * reachable. Never returns the endpoint URL or key; the repo and the site
 * are public.
 */
export async function GET() {
  const cfg = aiConfig();
  if (!cfg) return NextResponse.json({ enabled: false });
  try {
    const latencyMs = await pingModel(cfg);
    return NextResponse.json({ enabled: true, ok: true, model: cfg.model, latencyMs });
  } catch {
    return NextResponse.json({ enabled: true, ok: false, model: cfg.model });
  }
}
