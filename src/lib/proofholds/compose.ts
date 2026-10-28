/**
 * Seller side: drafting, editing and proposing a proofhold.
 */
import { z } from "zod";
import { acceptanceTestSchema, hashTest, type AcceptanceTest } from "../domain/test";
import { kinds, type Proofhold } from "../domain/proofhold";
import { appendAudit, createProofhold, updateProofhold } from "../store/repos";
import type { Sql } from "../store/sql";
import { ProofholdError, requireStatus, transition } from "./lifecycle";

export const draftInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  kind: z.enum(kinds),
  brief: z.string().trim().min(10).max(6000),
  amountCents: z.number().int().min(100).max(1_000_000),
  currency: z.enum(["USD", "EUR", "GBP", "CAD", "AUD"]).default("USD"),
  buyerEmail: z.string().trim().email().max(200).optional().nullable(),
  test: acceptanceTestSchema,
});
export type DraftInput = z.infer<typeof draftInputSchema>;

export async function createDraft(
  sql: Sql,
  workspaceId: string,
  raw: unknown,
): Promise<Proofhold> {
  const input = draftInputSchema.parse(raw);
  const ph = await createProofhold(sql, {
    workspaceId,
    title: input.title,
    kind: input.kind,
    brief: input.brief,
    amountCents: input.amountCents,
    currency: input.currency,
    buyerEmail: input.buyerEmail ?? null,
    test: input.test,
    testHash: hashTest(input.test),
    status: "draft",
  });
  await appendAudit(sql, ph.id, "created", {
    title: ph.title,
    kind: ph.kind,
    amountCents: ph.amountCents,
    currency: ph.currency,
    testHash: ph.testHash,
  });
  return ph;
}

export async function updateDraft(
  sql: Sql,
  ph: Proofhold,
  raw: unknown,
): Promise<Proofhold> {
  requireStatus(ph, ["draft"], "Editing");
  const input = draftInputSchema.partial().parse(raw);
  const test: AcceptanceTest | undefined = input.test;
  const updated = await updateProofhold(sql, ph.id, {
    title: input.title,
    kind: input.kind,
    brief: input.brief,
    amountCents: input.amountCents,
    currency: input.currency,
    buyerEmail: input.buyerEmail,
    ...(test ? { test, testHash: hashTest(test) } : {}),
  });
  if (test && updated.testHash !== ph.testHash)
    await appendAudit(sql, ph.id, "test_edited", {
      from: ph.testHash,
      to: updated.testHash,
    });
  return updated;
}

/** The seller agrees to the test and the link becomes live for the buyer. */
export async function propose(sql: Sql, ph: Proofhold): Promise<Proofhold> {
  requireStatus(ph, ["draft"], "Sending");
  if (ph.test.predicates.length === 0)
    throw new ProofholdError("Add at least one check first.");
  const now = new Date().toISOString();
  return transition(
    sql,
    ph,
    "proposed",
    { sellerAgreedAt: now },
    { type: "seller_agreed", data: { testHash: ph.testHash, at: now } },
  );
}

export async function cancel(
  sql: Sql,
  ph: Proofhold,
  by: "seller" | "buyer",
): Promise<Proofhold> {
  requireStatus(ph, ["draft", "proposed"], "Cancelling");
  return transition(sql, ph, "cancelled", {}, { type: "cancelled", data: { by } });
}
