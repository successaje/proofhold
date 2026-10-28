/**
 * Money moves. Only this module calls capture, void and refund.
 */
import { paypal } from "../paypal";
import { PayPalError } from "../paypal/client";
import type { Decision as DecisionRecord, Proofhold } from "../domain/proofhold";
import { recordDecision } from "../store/repos";
import type { Sql } from "../store/sql";
import { ProofholdError, requireStatus, transition } from "./lifecycle";

/** Make sure the authorization can still be captured; reauthorize once if the honor period passed. */
async function captureReady(sql: Sql, ph: Proofhold): Promise<string> {
  if (!ph.paypalAuthorizationId)
    throw new ProofholdError("No PayPal authorization on this proofhold.", 409);
  const pp = await paypal();
  const auth = await pp.getAuthorization(ph.paypalAuthorizationId);
  if (auth.status === "VOIDED")
    throw new ProofholdError("PayPal reports the hold was voided.", 409, "voided");
  if (auth.status === "CAPTURED")
    throw new ProofholdError(
      "PayPal reports the hold was already captured.",
      409,
      "captured",
    );
  if (Date.parse(auth.expiresAt) < Date.now())
    throw new ProofholdError("The PayPal authorization has expired.", 409, "expired");
  return ph.paypalAuthorizationId;
}

export async function release(
  sql: Sql,
  ph: Proofhold,
  input: {
    amountCents: number;
    final: boolean;
    actor: DecisionRecord["actor"];
    rationale: Record<string, unknown>;
  },
): Promise<Proofhold> {
  requireStatus(ph, ["awaiting_buyer", "in_review", "checking", "held"], "Releasing");
  const remaining = ph.amountCents - ph.releasedCents;
  const amount = Math.min(input.amountCents, remaining);
  if (amount <= 0) throw new ProofholdError("Nothing left to release.", 409);
  const authorizationId = await captureReady(sql, ph);
  const pp = await paypal();
  let capture;
  try {
    capture = await pp.capture(authorizationId, {
      amountCents: amount,
      currency: ph.currency,
      finalCapture: input.final || amount === remaining,
      invoiceId: `${ph.id}-${Date.now()}`,
      noteToPayer: `Proofhold release for "${ph.title}"`,
    });
  } catch (error) {
    if (error instanceof PayPalError)
      throw new ProofholdError(error.message, 502, "paypal");
    throw error;
  }
  const decision = await recordDecision(sql, {
    proofholdId: ph.id,
    outcome: amount === ph.amountCents ? "capture" : "partial_capture",
    amountCents: amount,
    actor: input.actor,
    rationale: { ...input.rationale, captureStatus: capture.status, mode: pp.mode },
    paypalCaptureId: capture.captureId,
    paypalDisputeId: null,
  });
  const releasedCents = ph.releasedCents + amount;
  const full = releasedCents >= ph.amountCents;
  const status = full ? "released" : "partially_released";
  let updated = await transition(
    sql,
    ph,
    status,
    {
      releasedCents,
      decidedAt: new Date().toISOString(),
      offerCents: null,
      offerNote: null,
    },
    {
      type: "released",
      data: {
        amountCents: amount,
        captureId: capture.captureId,
        captureStatus: capture.status,
        decisionId: decision.id,
        actor: input.actor,
        final: full,
      },
    },
  );
  if (!full) {
    // Partial release: the remainder goes back to the buyer.
    try {
      await pp.void(authorizationId);
      await recordDecision(sql, {
        proofholdId: ph.id,
        outcome: "void",
        amountCents: ph.amountCents - releasedCents,
        actor: input.actor,
        rationale: { reason: "Remainder voided after partial release" },
        paypalCaptureId: null,
        paypalDisputeId: null,
      });
      updated = await (
        await import("./lifecycle")
      ).note(sql, updated, "remainder_voided", {
        amountCents: ph.amountCents - releasedCents,
      });
    } catch (error) {
      await (
        await import("./lifecycle")
      ).note(sql, updated, "remainder_void_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return updated;
}

export async function voidHold(
  sql: Sql,
  ph: Proofhold,
  input: { actor: DecisionRecord["actor"]; reason: string },
): Promise<Proofhold> {
  requireStatus(
    ph,
    ["held", "checking", "awaiting_buyer", "in_review"],
    "Ending the hold",
  );
  if (!ph.paypalAuthorizationId)
    throw new ProofholdError("No PayPal authorization on this proofhold.", 409);
  const pp = await paypal();
  try {
    await pp.void(ph.paypalAuthorizationId);
  } catch (error) {
    if (error instanceof PayPalError && error.name_ !== "AUTHORIZATION_VOIDED")
      throw new ProofholdError(error.message, 502, "paypal");
  }
  const decision = await recordDecision(sql, {
    proofholdId: ph.id,
    outcome: "void",
    amountCents: ph.amountCents - ph.releasedCents,
    actor: input.actor,
    rationale: { reason: input.reason, mode: pp.mode },
    paypalCaptureId: null,
    paypalDisputeId: null,
  });
  return transition(
    sql,
    ph,
    "voided",
    { decidedAt: new Date().toISOString(), offerCents: null, offerNote: null },
    {
      type: "voided",
      data: { reason: input.reason, actor: input.actor, decisionId: decision.id },
    },
  );
}

export async function expire(
  sql: Sql,
  ph: Proofhold,
  reason: string,
): Promise<Proofhold> {
  requireStatus(
    ph,
    ["proposed", "held", "checking", "awaiting_buyer", "in_review"],
    "Expiring",
  );
  return transition(
    sql,
    ph,
    "expired",
    { decidedAt: new Date().toISOString() },
    { type: "expired", data: { reason } },
  );
}
