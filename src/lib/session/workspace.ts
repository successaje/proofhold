/**
 * Seller identity: a signed, httpOnly cookie naming the workspace.
 *
 * No passwords. A workspace is created on first visit with a name and a
 * payout email. The cookie value is `<workspaceId>.<hmac>`; the HMAC uses
 * APP_SECRET, so a forged id is rejected. Production would add Login with
 * PayPal or email magic links; the product model says so.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "../config";
import { db } from "../store/sql";
import { createWorkspace, getWorkspace, type Workspace } from "../store/repos";

export const COOKIE = "ph_workspace";

function sign(id: string): string {
  return createHmac("sha256", config().APP_SECRET).update(id).digest("base64url");
}

export function encode(id: string): string {
  return `${id}.${sign(id)}`;
}

export function decode(value: string | undefined): string | null {
  if (!value) return null;
  const [id, sig] = value.split(".");
  if (!id || !sig) return null;
  const expected = sign(id);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

export async function currentWorkspace(): Promise<Workspace | null> {
  const store = await cookies();
  const id = decode(store.get(COOKIE)?.value);
  if (!id) return null;
  return (await getWorkspace(await db(), id)) ?? null;
}

export function cookieOptions() {
  const secure = config().APP_URL.startsWith("https://");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

export async function startWorkspace(input: {
  name: string;
  email: string;
}): Promise<Workspace> {
  const ws = await createWorkspace(await db(), input);
  const store = await cookies();
  store.set(COOKIE, encode(ws.id), cookieOptions());
  return ws;
}

export async function endWorkspaceSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
