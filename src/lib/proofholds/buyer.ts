/**
 * Buyer responses and the seller's offer during review.
 */
import type { Proofhold } from "../domain/proofhold";
import { addMessage, latestRound, recordCheck, updateProofhold } from "../store/repos";
import type { Sql } from "../store/sql";
import { notify } from "../mail/notify";
import { evaluate } from "./evidence";
import { note, ProofholdError, requireStatus, transition } from "./lifecycle";
import { release, voidHold } from "./release";

/** A decision that arrives after the hold has closed gets a reason, not a generic refusal. */
function tooLate(ph: Proofhold, what: string): void {
  const closed: Record<string, string> = {
    released: "PayPal already captured the full amount",
    partially_released: "PayPal already captured the agreed share and returned the rest",
    voided: "the hold was already returned",
    expired: "the authorization already expired",
    refunded: "PayPal already refunded the capture",
    disputed: "a PayPal dispute is open on this capture",
    cancelled: "the seller cancelled before anything was held",
  };
  const why = closed[ph.status];
  if (why)
    throw new ProofholdError(
      `${what} is no longer possible: ${why}${ph.decidedAt ? ` on ${new Date(ph.decidedAt).toUTCString()}` : ""}. Reload the page to see the outcome.`,
      409,
      "closed",
    );
}

export async function confirm(
  sql: Sql,
  ph: Proofhold,
  message?: string | null,
): Promise<Proofhold> {
  tooLate(ph, "Confirming");
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
  tooLate(ph, "Objecting");
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
  const offered = await note(
    sql,
    ph,
    "offer_proposed",
    { amountCents: input.amountCents, note: text },
    { offerCents: input.amountCents, offerNote: text || null },
  );
  await notify(sql, offered, "offer");
  return offered;
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

/**
 * The seller withdraws the submission to change it. The verdicts and the
 * buyer window are cancelled; the hold goes back to "held" and the next
 * submission is a new round with fresh checks.
 */
export async function reopenForResubmission(sql: Sql, ph: Proofhold): Promise<Proofhold> {
  requireStatus(ph, ["in_review", "awaiting_buyer"], "Reopening");
  const reopened = await transition(
    sql,
    ph,
    "held",
    {
      buyerResponse: null,
      buyerRespondedAt: null,
      offerCents: null,
      offerNote: null,
      silenceWindowEndsAt: null,
      decision: null,
    },
    {
      type: "reopened",
      data: {
        reason:
          "Seller withdrew the submission to change it; the buyer window is cancelled.",
      },
    },
  );
  await notify(sql, reopened, "reopened");
  return reopened;
}
