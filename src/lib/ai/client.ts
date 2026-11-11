/**
 * The model client. Both prompts (compiler and examiner) go through
 * `generateStructured`, so the provider, the model and availability live in
 * one place. Two providers sit behind it: Anthropic (SDK) and Gemini (REST).
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { config } from "../config";
import { GeminiError, geminiStructured } from "./gemini";

export type AiProvider = "anthropic" | "gemini";

/** One piece of the user turn: text, or an image as base64. */
export type AiPart =
  { type: "text"; text: string } | { type: "image"; mime: string; base64: string };

export interface StructuredRequest<S extends z.ZodType> {
  system: string;
  parts: AiPart[];
  schema: S;
  maxTokens?: number;
}

export interface StructuredResult<T> {
  /** Null when the model refused or returned something the schema rejects. */
  output: T | null;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  provider: AiProvider;
}

let client: Anthropic | undefined;

export function aiAvailable(): boolean {
  return config().ai.configured;
}

export function aiProvider(): AiProvider | null {
  return config().ai.provider;
}

/** Which examiner judges judgement lines: the model, the labelled simulation, or none. */
export function examinerMode(): "model" | "simulated" | "off" {
  return config().examiner.mode;
}

export function examinerOn(): boolean {
  return examinerMode() !== "off";
}

export function model(): string {
  return config().ai.model;
}

export class AiUnavailable extends Error {
  constructor() {
    super(
      "The AI compiler and examiner are unavailable: set ANTHROPIC_API_KEY or GEMINI_API_KEY.",
    );
  }
}

function anthropic(): Anthropic {
  client ??= new Anthropic({
    apiKey: config().ANTHROPIC_API_KEY,
    maxRetries: 2,
    timeout: 90_000,
  });
  return client;
}

type AnthropicImageMime = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

async function viaAnthropic<S extends z.ZodType>(
  req: StructuredRequest<S>,
): Promise<StructuredResult<z.infer<S>>> {
  const content: Anthropic.ContentBlockParam[] = req.parts.map((p) =>
    p.type === "text"
      ? { type: "text", text: p.text }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: p.mime as AnthropicImageMime,
            data: p.base64,
          },
        },
  );
  const response = await anthropic().messages.parse({
    model: model(),
    max_tokens: req.maxTokens ?? 4000,
    system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium", format: zodOutputFormat(req.schema) },
    messages: [{ role: "user", content }],
  });
  const refused = response.stop_reason === "refusal" || !response.parsed_output;
  return {
    output: refused ? null : (response.parsed_output as z.infer<S>),
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    model: model(),
    provider: "anthropic",
  };
}

async function viaGemini<S extends z.ZodType>(
  req: StructuredRequest<S>,
): Promise<StructuredResult<z.infer<S>>> {
  const c = config();
  const call = (name: string) =>
    geminiStructured({
      apiKey: c.GEMINI_API_KEY as string,
      model: name,
      system: req.system,
      parts: req.parts,
      jsonSchema: z.toJSONSchema(req.schema),
      // Thinking tokens count against the output budget on Gemini.
      maxTokens: (req.maxTokens ?? 4000) * 2,
    });
  const fallback = c.GEMINI_FALLBACK_MODEL?.trim();
  let used = model();
  let reply;
  try {
    reply = await call(used);
  } catch (err) {
    // An overloaded or rate-limited primary: try the fallback model once.
    // The result names the model that actually answered.
    const canFallback =
      err instanceof GeminiError && err.retryable && fallback && fallback !== used;
    if (!canFallback) throw err;
    console.warn(`${used} is unavailable (${err.message}); using ${fallback}.`);
    used = fallback;
    reply = await call(used);
  }
  return {
    output: parseStructured(reply.text, req.schema),
    usage: reply.usage,
    model: used,
    provider: "gemini",
  };
}

/** Parse a model's JSON reply against the schema; null when it does not fit. */
export function parseStructured<S extends z.ZodType>(
  text: string | null,
  schema: S,
): z.infer<S> | null {
  if (!text) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** One structured-output call to whichever provider this deployment has a key for. */
export async function generateStructured<S extends z.ZodType>(
  req: StructuredRequest<S>,
): Promise<StructuredResult<z.infer<S>>> {
  const provider = aiProvider();
  if (!provider) throw new AiUnavailable();
  return provider === "gemini" ? viaGemini(req) : viaAnthropic(req);
}

/** Wrap untrusted text so the model treats it as data, never as instructions. */
export function asData(label: string, text: string): string {
  const clean = text.replace(/<\/?(data|instructions)[^>]*>/gi, "").trim();
  return `<data name="${label}">\n${clean}\n</data>`;
}
