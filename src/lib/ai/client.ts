/**
 * Shared Anthropic client. Both prompts (compiler and examiner) go through
 * here so model choice, effort and availability live in one place.
 */
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

let client: Anthropic | undefined;

export function aiAvailable(): boolean {
  return config().ai.configured;
}

export function anthropic(): Anthropic {
  if (!aiAvailable()) throw new AiUnavailable();
  client ??= new Anthropic({
    apiKey: config().ANTHROPIC_API_KEY,
    maxRetries: 2,
    timeout: 90_000,
  });
  return client;
}

export function model(): string {
  return config().ANTHROPIC_MODEL;
}

export class AiUnavailable extends Error {
  constructor() {
    super("The AI compiler and examiner are unavailable: ANTHROPIC_API_KEY is not set.");
  }
}

/** Wrap untrusted text so the model treats it as data, never as instructions. */
export function asData(label: string, text: string): string {
  const clean = text.replace(/<\/?(data|instructions)[^>]*>/gi, "").trim();
  return `<data name="${label}">\n${clean}\n</data>`;
}
