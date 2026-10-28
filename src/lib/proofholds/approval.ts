/**
 * Buyer approval: create the PayPal order when the buyer clicks, authorize
 * when they return, and record the hold.
 */
import { config } from "../config";
import { addDays, HONOR_PERIOD_DAYS } from "../paypal/client";
import { paypal } from "../paypal";
import type { Proofhold } from "../domain/proofhold";
import { getProofholdByOrder, updateProofhold } from "../store/repos";
import type { Sql } from "../store/sql";
import { note, ProofholdError, requireStatus, transition } from "./lifecycle";

export async function startApproval(
  sql: Sql,
  ph: Proofhold,
  buyer: { name: string; email: string },
): Promise<{ approveUrl: string; orderId: string }> {
  requireStatus(ph, ["proposed"], "Approving");
  const pp = await paypal();
  const base = config().APP_URL;
  const order = await pp.createAuthorizeOrder({
    amountCents: ph.amountCents,
    currency: ph.currency,
    customId: ph.testHash,
    referenceId: ph.id,
    description: `Proofhold: ${ph.title}`.slice(0, 127),
    returnUrl: `${base}/api/paypal/return?ph=${ph.id}`,
    cancelUrl: `${base}/api/paypal/cancel?ph=${ph.id}`,
    brandName: "Proofhold",
  });
  await note(
    sql,
    ph,
    "order_created",
    { orderId: order.orderId, customId: ph.testHash, mode: pp.mode },
    { paypalOrderId: order.orderId, buyerName: buyer.name, buyerEmail: buyer.email },
  );
  return { approveUrl: order.approveUrl, orderId: order.orderId };
}

/** Called when PayPal sends the buyer back with `token=<orderId>`. */
export async function completeApproval(sql: Sql, orderId: string): Promise<Proofhold> {
  const ph = await getProofholdByOrder(sql, orderId);
  if (!ph)
    throw new ProofholdError("No proofhold matches this PayPal order.", 404, "not_found");
  if (ph.status !== "proposed") return ph; // Already authorized (double return) or cancelled.
  const pp = await paypal();
  const result = await pp.authorizeOrder(orderId);
  const a = result.authorization;
  if (a.status !== "CREATED" && a.status !== "PENDING")
    throw new ProofholdError(
      `PayPal returned authorization status ${a.status}.`,
      502,
      "paypal",
    );
  const now = new Date().toISOString();
  return transition(
    sql,
    ph,
    "held",
    {
      paypalAuthorizationId: a.authorizationId,
      authorizationExpiresAt: a.expiresAt,
      honorPeriodEndsAt: addDays(a.createdAt, HONOR_PERIOD_DAYS),
      buyerAgreedAt: now,
      payerEmail: result.payerEmail,
      buyerName: ph.buyerName ?? result.payerName,
      lastReconciledAt: now,
    },
    {
      type: "buyer_agreed",
      data: {
        testHash: ph.testHash,
        orderId,
        authorizationId: a.authorizationId,
        amountCents: a.amountCents,
        currency: a.currency,
        expiresAt: a.expiresAt,
        payer: result.payerEmail,
        mode: pp.mode,
      },
    },
  );
}

export async function cancelApproval(
  sql: Sql,
  orderId: string,
): Promise<Proofhold | undefined> {
  const ph = await getProofholdByOrder(sql, orderId);
  if (!ph || ph.status !== "proposed") return ph;
  await updateProofhold(sql, ph.id, { paypalOrderId: null });
  return note(sql, ph, "approval_cancelled", { orderId });
}
