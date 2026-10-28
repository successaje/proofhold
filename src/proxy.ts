import { NextResponse, type NextRequest } from "next/server";

/** Exposes the request path to layouts so the start page can render without a workspace. */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/app/:path*"] };
