/**
 * Gemini adapter: one structured-output call over the Interactions API.
 *
 * Written against https://ai.google.dev/gemini-api/docs/structured-output and
 * the Interactions reference (revision 2026-05-20). Plain fetch, no SDK: the
 * request is one POST and the response is read from `steps`.
 */
import type { AiPart } from "./client";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const API_REVISION = "2026-05-20";
const TIMEOUT_MS = 60_000;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1_500];

/** A failed Gemini call. `retryable` is true for overload, rate limits and timeouts. */
export class GeminiError extends Error {
  constructor(
    detail: string,
    readonly retryable: boolean,
  ) {
    super(`Gemini request failed (${detail})`);
  }
}

export interface GeminiRequest {
  apiKey: string;
  model: string;
  system: string;
  parts: AiPart[];
  /** A JSON Schema; it is narrowed to the subset Gemini enforces before sending. */
  jsonSchema: unknown;
  maxTokens: number;
  /** Test seam. */
  fetchImpl?: typeof fetch;
  /** Test seam: skip the backoff between retries. */
  retryDelaysMs?: number[];
}

export interface GeminiResponse {
  /** The model's JSON text, or null when it produced none. */
  text: string | null;
  status: string;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Narrow a JSON Schema to what Gemini's constrained decoding documents:
 * `anyOf` instead of `oneOf`, `enum` instead of `const`, no `$schema`, and no
 * numeric bounds that only restate the safe-integer range. The caller still
 * validates the reply against the original schema.
 */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === "$schema") continue;
    if (key === "const") {
      out.enum = [value];
      continue;
    }
    if (
      (key === "minimum" || key === "maximum") &&
      typeof value === "number" &&
      Math.abs(value) >= Number.MAX_SAFE_INTEGER
    )
      continue;
    // `properties` maps names to schemas; a property may itself be called "const".
    if (key === "properties" && value && typeof value === "object") {
      out.properties = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([name, sub]) => [
          name,
          toGeminiSchema(sub),
        ]),
      );
      continue;
    }
    out[key === "oneOf" ? "anyOf" : key] = toGeminiSchema(value);
  }
  return out;
}

function toInput(parts: AiPart[]): unknown[] {
  return parts.map((p) =>
    p.type === "text"
      ? { type: "text", text: p.text }
      : { type: "image", data: p.base64, mime_type: p.mime },
  );
}

interface InteractionBody {
  status?: string;
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
  usage?: { total_input_tokens?: number; total_output_tokens?: number };
  error?: { code?: string | number; message?: string };
}

export async function geminiStructured(req: GeminiRequest): Promise<GeminiResponse> {
  const doFetch = req.fetchImpl ?? fetch;
  const delays = req.retryDelaysMs ?? RETRY_DELAYS_MS;
  const payload = JSON.stringify({
    model: req.model,
    system_instruction: req.system,
    input: toInput(req.parts),
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: toGeminiSchema(req.jsonSchema),
    },
    generation_config: { max_output_tokens: req.maxTokens },
    // Briefs and evidence belong to the parties; do not keep them server-side.
    store: false,
  });

  let lastError = "no response";
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delays[attempt - 1]));
    let res: Response;
    try {
      res = await doFetch(ENDPOINT, {
        method: "POST",
        headers: {
          "x-goog-api-key": req.apiKey,
          "Content-Type": "application/json",
          "Api-Revision": API_REVISION,
        },
        body: payload,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // A full timeout already cost a minute: let the caller fall back
      // instead of waiting on the same model again.
      if (err instanceof Error && err.name === "TimeoutError")
        throw new GeminiError(lastError, true);
      continue;
    }
    const raw = await res.text();
    let body: InteractionBody = {};
    try {
      body = JSON.parse(raw) as InteractionBody;
    } catch {
      // A non-JSON body is reported below with its status.
    }
    if (!res.ok) {
      lastError = `${res.status}: ${body.error?.message ?? (raw.slice(0, 200) || res.statusText)}`;
      if (RETRY_STATUS.has(res.status)) continue;
      throw new GeminiError(lastError, false);
    }
    const text = (body.steps ?? [])
      .filter((s) => s.type === "model_output")
      .flatMap((s) => s.content ?? [])
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string)
      .join("")
      .trim();
    return {
      text: text || null,
      status: body.status ?? "unknown",
      usage: {
        inputTokens: body.usage?.total_input_tokens ?? 0,
        outputTokens: body.usage?.total_output_tokens ?? 0,
      },
    };
  }
  throw new GeminiError(lastError, true);
}
