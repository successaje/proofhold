/**
 * Structured logs: one JSON object per line, secrets and personal data
 * redacted before they are written. Request ids tie an error page to a line.
 */
const SECRET_KEYS =
  /^(authorization|cookie|set-cookie|password|secret|token|api[_-]?key|client[_-]?secret|access[_-]?token)$/i;
const EMAIL = /([^\s@]{1})[^\s@]*(@[^\s@]+)/g;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[deep]";
  if (typeof value === "string") return value.replace(EMAIL, "$1…$2");
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      out[k] = SECRET_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
    return out;
  }
  return value;
}

export type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = order[(process.env.LOG_LEVEL as Level) ?? "info"] ?? 20;

export function log(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (order[level] < threshold) return;
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    msg,
    ...(redact(fields) as object),
  });
  if (level === "error" || level === "warn") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export function describeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error)
    return {
      name: err.name,
      message: err.message,
      stack: err.stack?.split("\n").slice(0, 6).join("\n"),
    };
  return { error: String(err) };
}
