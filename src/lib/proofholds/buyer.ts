/**
 * Buyer responses and the seller's offer during review.
 */
import type { Proofhold } from "../domain/proofhold";
import { addMessage, latestRound, recordCheck, updateProofhold } from "../store/repos";
import type { Sql } from "../store/sql";
import { evaluate } from "./evidence";
import { note, ProofholdError, requireStatus } from "./lifecycle";
import { release, voidHold } from "./release";

export async function confirm(
  sql: Sql,
  ph: Proofhold,
  message?: string | null,
): Promise<Proofhold> {
  requireStatus(ph, ["awaiting_buyer", "in_review", "held"], "Confirming");
  const now = new Date().toISOString();
  const round = await latestRound(sql, ph.id);
  for (const p of ph.test.predicates) {
    if (p.check.kind === "buyer_confirms")
      await recordCheck(sql, {
        proofholdId: ph.id,
        predicateId: p.id,
        round: Math.max(round, 1),
        source: "buyer",
        verdict: "pass",
        confidence: null,
        reasons: ["Buyer confirmed"],
        detail: {},
      });
  }
  if (message)
    await addMessage(sql, { proofholdId: ph.id, author: "buyer", body: message });
  const updated = await note(
    sql,
    ph,
    "buyer_confirmed",
    { at: now, message: message ?? null },
    { buyerResponse: "confirmed", buyerRespondedAt: now },
  );
  if (updated.status === "held") {
    // No evidence was ever submitted; the buyer is releasing on trust.
    return release(sql, updated, {
      amountCents: ph.amountCents,
      final: true,
      actor: "buyer",
      rationale: { reason: "Buyer confirmed without a submission" },
    });
  }
  return evaluate(sql, updated);
}

export async function object(
  sql: Sql,
  ph: Proofhold,
  reason: string,
): Promise<Proofhold> {
  requireStatus(ph, ["awaiting_buyer"], "Objecting");
  const text = reason.trim();
  if (text.length < 5)
    throw new ProofholdError("Say what is wrong so the seller can respond.");
  const now = new Date().toISOString();
  const round = await latestRound(sql, ph.id);
  for (const p of ph.test.predicates) {
    if (p.check.kind === "buyer_confirms")
      await recordCheck(sql, {
        proofholdId: ph.id,
        predicateId: p.id,
        round: Math.max(round, 1),
        source: "buyer",
        verdict: "fail",
        confidence: null,
        reasons: [text],
        detail: {},
      });
  }
  await addMessage(sql, { proofholdId: ph.id, author: "buyer", body: text });
  const updated = await note(
    sql,
    ph,
    "buyer_objected",
    { at: now, reason: text },
    { buyerResponse: "objected", buyerRespondedAt: now },
  );
  return evaluate(sql, updated);
}

export async function proposeOffer(
  sql: Sql,
  ph: Proofhold,
  input: { amountCents: number; note: string },
): Promise<Proofhold> {
  requireStatus(ph, ["in_review"], "Proposing a partial release");
  const remaining = ph.amountCents - ph.releasedCents;
  if (
    !Number.isInteger(input.amountCents) ||
    input.amountCents <= 0 ||
    input.amountCents > remaining
  )
    throw new ProofholdError(
      `Offer must be between 0.01 and ${(remaining / 100).toFixed(2)} ${ph.currency}.`,
    );
  const text = input.note.trim();
  if (text) await addMessage(sql, { proofholdId: ph.id, author: "seller", body: text });
  return note(
    sql,
    ph,
    "offer_proposed",
    { amountCents: input.amountCents, note: text },
    { offerCents: input.amountCents, offerNote: text || null },
  );
}

export async function acceptOffer(sql: Sql, ph: Proofhold): Promise<Proofhold> {
  requireStatus(ph, ["in_review"], "Accepting the offer");
  if (!ph.offerCents) throw new ProofholdError("There is no offer to accept.", 409);
  const noted = await note(sql, ph, "offer_accepted", { amountCents: ph.offerCents });
  return release(sql, noted, {
    amountCents: ph.offerCents,
    final: false,
    actor: "buyer",
    rationale: {
      reason: "Buyer accepted the seller's partial-release offer",
      offerNote: ph.offerNote,
    },
  });
}

export async function declineOffer(
  sql: Sql,
  ph: Proofhold,
  reason?: string | null,
): Promise<Proofhold> {
  requireStatus(ph, ["in_review"], "Declining the offer");
  if (!ph.offerCents) throw new ProofholdError("There is no offer to decline.", 409);
  if (reason?.trim())
    await addMessage(sql, { proofholdId: ph.id, author: "buyer", body: reason.trim() });
  const noted = await note(
    sql,
    ph,
    "offer_declined",
    { amountCents: ph.offerCents, reason: reason ?? null },
    { offerCents: null, offerNote: null },
  );
  return voidHold(sql, noted, {
    actor: "buyer",
    reason: "Buyer declined the partial-release offer; the hold is returned.",
  });
}

export async function endHold(
  sql: Sql,
  ph: Proofhold,
  by: "seller" | "buyer",
  reason: string,
): Promise<Proofhold> {
  return voidHold(sql, ph, { actor: by, reason });
}

export async function reopenForResubmission(sql: Sql, ph: Proofhold): Promise<Proofhold> {
  requireStatus(ph, ["in_review", "awaiting_buyer"], "Reopening");
  const updated = await updateProofhold(sql, ph.id, {
    buyerResponse: null,
    buyerRespondedAt: null,
    offerCents: null,
    offerNote: null,
    silenceWindowEndsAt: null,
  });
  return note(sql, updated, "reopened", {});
}
