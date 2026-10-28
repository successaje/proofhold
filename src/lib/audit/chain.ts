/**
 * Append-only hash chain over a proofhold's history.
 *
 * Each entry hashes (proofhold id, sequence, type, canonical data, previous
 * hash). The exported chain is the "evidence bundle": either party can verify
 * that no entry was altered or removed after the fact.
 */
import { createHash } from "node:crypto";
import { canonicalJson } from "../domain/test";

export interface AuditEntry {
  id: string;
  proofholdId: string;
  seq: number;
  type: string;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
  createdAt: string;
}

export const GENESIS = "0".repeat(64);

export function entryHash(entry: Omit<AuditEntry, "hash" | "id">): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        proofholdId: entry.proofholdId,
        seq: entry.seq,
        type: entry.type,
        data: entry.data,
        prevHash: entry.prevHash,
        createdAt: entry.createdAt,
      }),
    )
    .digest("hex");
}

/** Returns the index of the first broken link, or -1 when the chain is intact. */
export function verifyChain(entries: AuditEntry[]): number {
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.seq !== i + 1 || e.prevHash !== prev) return i;
    if (entryHash(e) !== e.hash) return i;
    prev = e.hash;
  }
  return -1;
}
