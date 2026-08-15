/**
 * The one model client — SERVER ONLY, used by app/api/ai/* routes.
 *
 * Every call is a STRUCTURED call: the caller supplies a JSON Schema and gets
 * a parsed object back. Free-form generation is deliberately not exported —
 * structured output is what makes a 4B local model reliable here (and an
 * order of magnitude faster on LM Studio).
 *
 * The model classifies and writes text. It never computes an amount: money
 * figures either come from SQL (price suggestion) or are extracted verbatim
 * from the user's own words and re-validated against MONEY_RE server-side.
 */

import { type AiConfig } from "./config";

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number = 502,
  ) {
    super(message);
  }
}

export interface ChatJsonArgs {
  system: string;
  user: string;
  /** data: URLs (image/jpeg|png|webp). Vision-capable models only. */
  images?: string[];
  schemaName: string;
  schema: Record<string, unknown>;
  /** Override the configured temperature (0 for extraction tasks). */
  temperature?: number;
}

export async function chatJSON<T>(cfg: AiConfig, args: ChatJsonArgs): Promise<T> {
  const raw =
    cfg.provider === "anthropic" ? await anthropicCall(cfg, args) : await openaiCall(cfg, args);
  try {
    return JSON.parse(raw) as T;
  } catch {
    /* Some OpenAI-compatible servers ignore json_schema and fence the JSON. */
    const fenced = raw.match(/\{[\s\S]*\}/);
    if (fenced) {
      try {
        return JSON.parse(fenced[0]) as T;
      } catch {
        /* fall through */
      }
    }
    throw new AiError("model returned non-JSON output");
  }
}

/** Minimal round-trip for «اختبر الاتصال». Returns latency in ms. */
export async function pingModel(cfg: AiConfig): Promise<number> {
  const t0 = Date.now();
  await chatJSON<{ ok: boolean }>(cfg, {
    system: "أنت فحص اتصال. أعد ok=true.",
    user: "فحص",
    schemaName: "ping",
    schema: {
      type: "object",
      properties: { ok: { type: "boolean" } },
      required: ["ok"],
      additionalProperties: false,
    },
    temperature: 0,
  });
  return Date.now() - t0;
}

/* ---------------- OpenAI-compatible (LM Studio, OpenAI, …) ---------------- */

type OpenAiContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

async function openaiCall(cfg: AiConfig, args: ChatJsonArgs): Promise<string> {
  const content: OpenAiContent = args.images?.length
    ? [
        { type: "text", text: args.user },
        ...args.images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ]
    : args.user;

  const body = {
    model: cfg.model,
    temperature: args.temperature ?? cfg.temperature,
    max_tokens: cfg.maxTokens,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: args.schemaName, strict: true, schema: args.schema },
    },
  };

  const res = await fetchWithTimeout(
    `${cfg.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    },
    cfg.timeoutMs,
  );

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new AiError("empty model response");
  return text;
}

/* ------------------------------- Anthropic ------------------------------- */

async function anthropicCall(cfg: AiConfig, args: ChatJsonArgs): Promise<string> {
  const content: Array<Record<string, unknown>> = [{ type: "text", text: args.user }];
  for (const url of args.images ?? []) {
    const m = url.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!m) throw new AiError("images must be base64 data URLs", 400);
    content.push({
      type: "image",
      source: { type: "base64", media_type: m[1], data: m[2] },
    });
  }

  const res = await fetchWithTimeout(
    `${cfg.baseUrl}/v1/messages`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        temperature: args.temperature ?? cfg.temperature,
        system: args.system,
        messages: [{ role: "user", content }],
        tools: [
          {
            name: args.schemaName,
            description: "أعد النتيجة بهذا الشكل حصراً.",
            input_schema: args.schema,
          },
        ],
        tool_choice: { type: "tool", name: args.schemaName },
      }),
    },
    cfg.timeoutMs,
  );

  const json = (await res.json()) as {
    content?: Array<{ type: string; input?: unknown }>;
  };
  const tool = json.content?.find((b) => b.type === "tool_use");
  if (!tool?.input) throw new AiError("empty model response");
  return JSON.stringify(tool.input);
}

/* --------------------------------- shared -------------------------------- */

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new AiError(
      e instanceof DOMException && e.name === "TimeoutError"
        ? "model timeout"
        : "model unreachable",
    );
  }
  if (!res.ok) throw new AiError(`model error ${res.status}`, 502);
  return res;
}
