/**
 * Runtime configuration, read once from the environment and validated.
 *
 * Optional capabilities (PayPal credentials, a model key, mail) degrade to
 * named states so the UI can explain what is missing instead of failing.
 */
import { z } from "zod";

const schema = z.object({
  APP_URL: z.string().url().default("http://127.0.0.1:3200"),
  APP_SECRET: z.string().min(16).default("proofhold-development-secret-change-me"),
  PROOFHOLD_STORE: z.enum(["sqlite", "postgres"]).default("sqlite"),
  PROOFHOLD_DATA_DIR: z.string().default(".data"),
  DATABASE_URL: z.string().optional(),
  PAYPAL_MODE: z.enum(["sandbox", "simulated"]).default("simulated"),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  // Used when the primary Gemini model is overloaded or rate-limited. Blank disables it.
  GEMINI_FALLBACK_MODEL: z.string().default("gemini-3.5-flash-lite"),
  AI_PROVIDER: z.enum(["auto", "anthropic", "gemini"]).default("auto"),
  PROOFHOLD_SCHEDULER: z.enum(["inline", "external", "off"]).default("inline"),
  TICK_SECRET: z.string().optional(),
  DEMO_SILENCE_MINUTES: z.coerce.number().positive().optional(),
  EXAMINER_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  MAIL_PROVIDER: z.enum(["simulated", "resend"]).default("simulated"),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Proofhold <proofhold@example.com>"),
  // "anthropic" is accepted for older env files and means the same as "auto".
  EXAMINER_MODE: z.enum(["auto", "anthropic", "simulated", "off"]).default("auto"),
  NODE_ENV: z.string().default("development"),
});

export type Config = z.infer<typeof schema> & {
  paypal: { mode: "sandbox" | "simulated"; configured: boolean };
  ai: {
    configured: boolean;
    /** The provider whose key is in use, or null when the compiler and examiner are off. */
    provider: "anthropic" | "gemini" | null;
    model: string;
  };
  mail: { provider: "simulated" | "resend"; configured: boolean };
  examiner: { mode: "model" | "simulated" | "off" };
};

let cached: Config | undefined;

export function config(): Config {
  if (cached) return cached;
  const parsed = schema.parse(process.env);
  const paypalConfigured = Boolean(
    parsed.PAYPAL_CLIENT_ID && parsed.PAYPAL_CLIENT_SECRET,
  );
  const mode =
    parsed.PAYPAL_MODE === "sandbox" && paypalConfigured ? "sandbox" : "simulated";
  if (parsed.PAYPAL_MODE === "sandbox" && !paypalConfigured) {
    console.warn(
      "PAYPAL_MODE=sandbox but PAYPAL_CLIENT_ID/SECRET are missing; running simulated.",
    );
  }
  if (parsed.PROOFHOLD_STORE === "postgres" && !parsed.DATABASE_URL) {
    throw new Error("PROOFHOLD_STORE=postgres requires DATABASE_URL.");
  }
  const mailConfigured = Boolean(parsed.RESEND_API_KEY);
  const aiProvider = resolveAiProvider(parsed);
  if (parsed.AI_PROVIDER !== "auto" && !aiProvider)
    console.warn(
      `AI_PROVIDER=${parsed.AI_PROVIDER} but its API key is missing; the compiler and examiner are off.`,
    );
  if (parsed.MAIL_PROVIDER === "resend" && !mailConfigured)
    console.warn(
      "MAIL_PROVIDER=resend but RESEND_API_KEY is missing; mail stays in the outbox.",
    );
  cached = {
    ...parsed,
    paypal: { mode, configured: paypalConfigured },
    ai: {
      configured: aiProvider !== null,
      provider: aiProvider,
      model: aiProvider === "gemini" ? parsed.GEMINI_MODEL : parsed.ANTHROPIC_MODEL,
    },
    mail: {
      provider:
        parsed.MAIL_PROVIDER === "resend" && mailConfigured ? "resend" : "simulated",
      configured: mailConfigured,
    },
    examiner: {
      mode:
        parsed.EXAMINER_MODE === "simulated"
          ? "simulated"
          : parsed.EXAMINER_MODE === "off"
            ? "off"
            : aiProvider
              ? "model"
              : "off",
    },
  };
  return cached;
}

/**
 * Which model provider to use. "auto" prefers Anthropic when both keys are
 * set; a named provider without its key resolves to none.
 */
function resolveAiProvider(parsed: {
  AI_PROVIDER: "auto" | "anthropic" | "gemini";
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
}): "anthropic" | "gemini" | null {
  const anthropic = Boolean(parsed.ANTHROPIC_API_KEY?.trim());
  const gemini = Boolean(parsed.GEMINI_API_KEY?.trim());
  if (parsed.AI_PROVIDER === "anthropic") return anthropic ? "anthropic" : null;
  if (parsed.AI_PROVIDER === "gemini") return gemini ? "gemini" : null;
  return anthropic ? "anthropic" : gemini ? "gemini" : null;
}

/** Test hook: clear the cached configuration after mutating process.env. */
export function resetConfig() {
  cached = undefined;
}
