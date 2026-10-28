import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford base32, lowercase

function base32(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += ALPHABET[b % 32];
  return out;
}

/** Short, URL-safe, prefixed identifier such as `ph_7k2m9...`. */
export function newId(prefix: string, length = 14): string {
  return `${prefix}_${base32(randomBytes(length))}`;
}

/** Unguessable capability token for buyer links (192 bits). */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function nowIso(): string {
  return new Date().toISOString();
}
