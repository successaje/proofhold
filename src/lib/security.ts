/**
 * Request-level protections that do not depend on the framework: same-origin
 * checks for cookie-authenticated mutations, a token-bucket rate limiter, and
 * the headers every response carries.
 */

/** Routes that are called server-to-server and authenticate themselves. */
export const ORIGIN_EXEMPT = ["/api/paypal/webhook", "/api/internal/tick"];

/**
 * A mutation is accepted only when the request names our origin: either
 * `Sec-Fetch-Site` says same-origin or same-site, or `Origin` is ours. A request
 * with neither header is refused too, so a non-browser client has to send
 * `Origin: <APP_URL>` on purpose; that costs a script one header and leaves no
 * gap for a browser that strips the headers.
 */
export function isSameOrigin(
  headers: { get(name: string): string | null },
  appUrl: string,
): boolean {
  const site = headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = headers.get("origin");
  if (origin && origin !== "null") {
    try {
      return new URL(origin).origin === new URL(appUrl).origin;
    } catch {
      return false;
    }
  }
  return site === "same-origin" || site === "same-site" || site === "none";
}

export interface RateRule {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/** Which rule a method and path fall under, if any. */
export function rateRuleFor(method: string, path: string): [string, RateRule] | null {
  const mutating = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (path === "/api/workspace" && method === "POST")
    return ["workspace", { limit: 20, windowMs: 60 * 60_000 }];
  if (path === "/api/compile" && mutating)
    return ["compile", { limit: 60, windowMs: 10 * 60_000 }];
  if (/^\/api\/p\/[^/]+\//.test(path) && mutating)
    return ["buyer", { limit: 90, windowMs: 10 * 60_000 }];
  if (/^\/api\/proofholds\/[^/]+\/(evidence|tracking|submit)/.test(path) && mutating)
    return ["evidence", { limit: 120, windowMs: 10 * 60_000 }];
  if (/^\/api\/paypal\/(return|cancel)/.test(path))
    return ["paypal", { limit: 120, windowMs: 10 * 60_000 }];
  if (/^\/api\/sim\//.test(path) && mutating)
    return ["sim", { limit: 120, windowMs: 10 * 60_000 }];
  return null;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/** In-memory fixed-window limiter. One instance per process; fine for one web node. */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(private readonly now: () => number = Date.now) {}

  /** Returns the seconds to wait when the request is over the limit, else 0. */
  hit(key: string, rule: RateRule): number {
    const t = this.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= t) {
      this.buckets.set(key, { count: 1, resetAt: t + rule.windowMs });
      if (this.buckets.size > 10_000) this.sweep(t);
      return 0;
    }
    b.count += 1;
    return b.count > rule.limit ? Math.max(1, Math.ceil((b.resetAt - t) / 1000)) : 0;
  }

  private sweep(t: number) {
    for (const [k, b] of this.buckets) if (b.resetAt <= t) this.buckets.delete(k);
  }
}

/** The client address as the platform reports it; "local" when nothing does. */
export function clientAddress(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "local";
}

/** Response headers for every route. HSTS only when the app is served over HTTPS. */
export function securityHeaders(appUrl: string, dev: boolean): Record<string, string> {
  const https = appUrl.startsWith("https://");
  const csp = [
    "default-src 'self'",
    // Next.js emits inline bootstrap scripts; dev also needs eval for fast refresh.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://www.sandbox.paypal.com https://www.paypal.com",
    "base-uri 'self'",
    "object-src 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    ...(https
      ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }
      : {}),
  };
}
