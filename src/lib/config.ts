/**
 * Runtime configuration, read once from the environment and validated.
 *
 * Optional capabilities (PayPal credentials, Anthropic key, mail) degrade to
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
  PROOFHOLD_SCHEDULER: z.enum(["inline", "external", "off"]).default("inline"),
  TICK_SECRET: z.string().optional(),
  DEMO_SILENCE_MINUTES: z.coerce.number().positive().optional(),
  EXAMINER_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  NODE_ENV: z.string().default("development"),
});

export type Config = z.infer<typeof schema> & {
  paypal: { mode: "sandbox" | "simulated"; configured: boolean };
  ai: { configured: boolean };
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
  cached = {
    ...parsed,
    paypal: { mode, configured: paypalConfigured },
    ai: { configured: Boolean(parsed.ANTHROPIC_API_KEY) },
  };
  return cached;
}

/** Test hook: clear the cached configuration after mutating process.env. */
export function resetConfig() {
  cached = undefined;
}
