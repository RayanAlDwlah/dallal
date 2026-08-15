/**
 * AI provider configuration — SERVER ONLY. Never import from a client
 * component. The key stays on the server (§6: the repo is public, nothing
 * here may start with NEXT_PUBLIC_), and every model call goes through an
 * app route under app/api/ai/*.
 *
 * Provider, model and sampling are SETTINGS, not code (ai.html «الإعداد»):
 * swap them per environment without a deploy. When nothing is configured the
 * assistive features hide themselves and the product keeps working —
 * «تختفي المساعدة، ما يتعطّل المنتج».
 */

export interface AiConfig {
  provider: "openai-compatible" | "anthropic";
  baseUrl: string;
  apiKey: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

export function aiConfig(): AiConfig | null {
  const provider = process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "openai-compatible";
  const model = process.env.AI_MODEL?.trim();
  if (!model) return null;

  if (provider === "anthropic") {
    if (!process.env.AI_API_KEY) return null;
    return {
      provider,
      baseUrl: process.env.AI_BASE_URL?.trim() || "https://api.anthropic.com",
      apiKey: process.env.AI_API_KEY,
      model,
      temperature: readNumber(process.env.AI_TEMPERATURE, 0.3),
      maxTokens: Math.trunc(readNumber(process.env.AI_MAX_TOKENS, 800)),
      timeoutMs: Math.trunc(readNumber(process.env.AI_TIMEOUT_MS, 90_000)),
    };
  }

  const baseUrl = process.env.AI_BASE_URL?.trim();
  if (!baseUrl) return null;
  return {
    provider,
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey: process.env.AI_API_KEY ?? null,
    model,
    temperature: readNumber(process.env.AI_TEMPERATURE, 0.3),
    maxTokens: Math.trunc(readNumber(process.env.AI_MAX_TOKENS, 800)),
    timeoutMs: Math.trunc(readNumber(process.env.AI_TIMEOUT_MS, 90_000)),
  };
}

export function aiEnabled(): boolean {
  return aiConfig() !== null;
}

/* Sampling knobs are plain numbers, never money — Number() is fine here. */
function readNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
