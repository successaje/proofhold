/**
 * After capture, PayPal decides. Proofhold's job is to hand PayPal the
 * evidence bundle and keep the proofhold's status in step with the dispute.
 */
import { paypal } from "../paypal";
import { PayPalError } from "../paypal/client";
import type { Proofhold } from "../domain/proofhold";
import {
  getEvidenceBytes,
  listDecisions,
  listEvidence,
  recordDecision,
} from "../store/repos";
import type { Sql } from "../store/sql";
import { bundleSummaryText, evidenceBundle } from "./bundle";
import { note, ProofholdError, requireStatus, transition } from "./lifecycle";

/** Sandbox only: open a dispute as the buyer against the capture. */
export async function openSandboxDispute(
  sql: Sql,
  ph: Proofhold,
  input: {
    buyerTransactionId?: string | null;
    reason:
      "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" | "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED";
    buyerEmail?: string | null;
  },
): Promise<Proofhold> {
  requireStatus(ph, ["released", "partially_released"], "Opening a dispute");
  const pp = await paypal();
  const captures = (await listDecisions(sql, ph.id)).filter((d) => d.paypalCaptureId);
  const capture = captures[captures.length - 1];
  if (!capture?.paypalCaptureId) throw new ProofholdError("No capture to dispute.", 409);
  const buyerTransactionId = input.buyerTransactionId?.trim() || capture.paypalCaptureId;
  const buyerEmail = input.buyerEmail?.trim() || ph.payerEmail || ph.buyerEmail;
  if (!buyerEmail)
    throw new ProofholdError("A buyer email is needed to open a sandbox dispute.");
  let dispute;
  try {
    dispute = await pp.createSandboxDispute({
      buyerTransactionId,
      buyerEmail,
      reason: input.reason,
      money: { amountCents: capture.amountCents, currency: ph.currency },
    });
  } catch (error) {
    if (error instanceof PayPalError)
      throw new ProofholdError(error.message, 502, "paypal");
    throw error;
  }
  await recordDecision(sql, {
    proofholdId: ph.id,
    outcome: "escalate",
    amountCents: capture.amountCents,
    actor: "buyer",
    rationale: { reason: input.reason, buyerTransactionId, mode: pp.mode },
    paypalCaptureId: capture.paypalCaptureId,
    paypalDisputeId: dispute.disputeId,
  });
  return transition(
    sql,
    ph,
    "disputed",
    { paypalDisputeId: dispute.disputeId },
    {
      type: "dispute_opened",
      data: {
        disputeId: dispute.disputeId,
        status: dispute.status,
        reason: input.reason,
        captureId: capture.paypalCaptureId,
      },
    },
  );
}

/** File the evidence bundle with PayPal through provide-evidence. */
export async function fileEvidence(sql: Sql, ph: Proofhold): Promise<Proofhold> {
  requireStatus(ph, ["disputed"], "Filing evidence");
  if (!ph.paypalDisputeId) throw new ProofholdError("No dispute on this proofhold.", 409);
  const pp = await paypal();
  const bundle = await evidenceBundle(sql, ph);
  const files = [
    {
      name: `proofhold-${ph.id}-bundle.json`,
      mime: "application/json",
      bytes: new TextEncoder().encode(JSON.stringify(bundle, null, 2)),
    },
  ];
  for (const item of (await listEvidence(sql, ph.id))
    .filter((e) => e.kind === "file")
    .slice(0, 8)) {
    const stored = await getEvidenceBytes(sql, item.id);
    if (
      stored?.bytes &&
      item.mime &&
      /^(image\/(png|jpeg|gif)|application\/pdf)$/.test(item.mime)
    )
      files.push({
        name: item.name,
        mime: item.mime,
        bytes: new Uint8Array(stored.bytes),
      });
  }
  try {
    await pp.provideEvidence(ph.paypalDisputeId, bundleSummaryText(bundle), files);
  } catch (error) {
    if (error instanceof PayPalError)
      throw new ProofholdError(error.message, 502, "paypal");
    throw error;
  }
  return note(sql, ph, "evidence_filed", {
    disputeId: ph.paypalDisputeId,
    files: files.map((f) => f.name),
    bundleEntries: bundle.audit.entries.length,
  });
}

/** Sandbox only: PayPal's decision, simulated through the adjudicate endpoint. */
export async function adjudicate(
  sql: Sql,
  ph: Proofhold,
  outcome: "BUYER_FAVOR" | "SELLER_FAVOR",
): Promise<Proofhold> {
  requireStatus(ph, ["disputed"], "Adjudicating");
  if (!ph.paypalDisputeId) throw new ProofholdError("No dispute on this proofhold.", 409);
  const pp = await paypal();
  try {
    const current = await pp.getDispute(ph.paypalDisputeId);
    if (
      current.actions.includes("require-evidence") &&
      current.status === "UNDER_REVIEW" &&
      !current.actions.includes("adjudicate")
    ) {
      await pp.requireEvidence(ph.paypalDisputeId, "SELLER_EVIDENCE");
    }
    await pp.adjudicate(ph.paypalDisputeId, outcome);
  } catch (error) {
    if (error instanceof PayPalError)
      throw new ProofholdError(error.message, 502, "paypal");
    throw error;
  }
  return syncDispute(sql, ph);
}

/** Pull the dispute's state from PayPal and move the proofhold accordingly. */
export async function syncDispute(sql: Sql, ph: Proofhold): Promise<Proofhold> {
  if (ph.status !== "disputed" || !ph.paypalDisputeId) return ph;
  const pp = await paypal();
  const d = await pp.getDispute(ph.paypalDisputeId);
  if (d.status !== "RESOLVED")
    return note(
      sql,
      ph,
      "dispute_synced",
      { status: d.status, actions: d.actions },
      { lastReconciledAt: new Date().toISOString() },
    );
  const buyerWon = (d.outcome ?? "").includes("BUYER");
  if (buyerWon) {
    return transition(
      sql,
      ph,
      "refunded",
      { decidedAt: new Date().toISOString() },
      { type: "dispute_resolved", data: { outcome: d.outcome, disputeId: d.disputeId } },
    );
  }
  const to = ph.releasedCents >= ph.amountCents ? "released" : "partially_released";
  return transition(
    sql,
    ph,
    to,
    { decidedAt: new Date().toISOString() },
    { type: "dispute_resolved", data: { outcome: d.outcome, disputeId: d.disputeId } },
  );
}
