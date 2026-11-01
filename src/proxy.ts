import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import {
  ORIGIN_EXEMPT,
  RateLimiter,
  clientAddress,
  isSameOrigin,
  rateRuleFor,
} from "@/lib/security";

const limiter = new RateLimiter();

/**
 * Runs before every app and API request: tags it with a request id, refuses
 * cross-site mutations (the session is a cookie), and rate-limits the public
 * surfaces. Also exposes the path to layouts so the start page can render
 * without a workspace.
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const method = request.method;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const appUrl =
    process.env.APP_URL ?? `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  if (path.startsWith("/api/")) {
    const mutating = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
    if (
      mutating &&
      !ORIGIN_EXEMPT.includes(path) &&
      !isSameOrigin(request.headers, appUrl)
    ) {
      return NextResponse.json(
        { error: "Cross-site requests are not accepted.", code: "cross_site" },
        { status: 403, headers: { "x-request-id": requestId } },
      );
    }
    const rule = rateRuleFor(method, path);
    if (rule) {
      const wait = limiter.hit(`${rule[0]}:${clientAddress(request.headers)}`, rule[1]);
      if (wait > 0)
        return NextResponse.json(
          { error: `Too many requests. Try again in ${wait} s.`, code: "rate_limited" },
          {
            status: 429,
            headers: { "Retry-After": String(wait), "x-request-id": requestId },
          },
        );
    }
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", path);
  headers.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = { matcher: ["/app/:path*", "/api/:path*", "/p/:path*"] };
