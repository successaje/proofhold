/**
 * Shared helpers for every module that changes a proofhold: status
 * transitions go through `transition`, which asserts the state machine and
 * writes the audit entry in the same step.
 */
import { assertTransition, type Proofhold, type Status } from "../domain/proofhold";
import { appendAudit, getProofhold, updateProofhold } from "../store/repos";
import type { Sql } from "../store/sql";

export class ProofholdError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "invalid",
  ) {
    super(message);
  }
}

export async function transition(
  sql: Sql,
  ph: Proofhold,
  to: Status,
  patch: Parameters<typeof updateProofhold>[2] = {},
  audit: { type?: string; data?: Record<string, unknown> } = {},
): Promise<Proofhold> {
  assertTransition(ph.status, to);
  const updated = await updateProofhold(sql, ph.id, { ...patch, status: to });
  await appendAudit(sql, ph.id, audit.type ?? "status", {
    from: ph.status,
    to,
    ...(audit.data ?? {}),
  });
  return updated;
}

export async function note(
  sql: Sql,
  ph: Proofhold,
  type: string,
  data: Record<string, unknown>,
  patch: Parameters<typeof updateProofhold>[2] = {},
): Promise<Proofhold> {
  const updated =
    Object.keys(patch).length > 0 ? await updateProofhold(sql, ph.id, patch) : ph;
  await appendAudit(sql, ph.id, type, data);
  return updated;
}

export async function requireProofhold(sql: Sql, id: string): Promise<Proofhold> {
  const ph = await getProofhold(sql, id);
  if (!ph) throw new ProofholdError("Proofhold not found", 404, "not_found");
  return ph;
}

export function requireStatus(ph: Proofhold, allowed: Status[], what: string): void {
  if (!allowed.includes(ph.status))
    throw new ProofholdError(
      `${what} is not possible while the proofhold is ${ph.status.replace("_", " ")}.`,
      409,
      "wrong_status",
    );
}
