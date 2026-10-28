/**
 * Keeping Proofhold's view in step with PayPal's: reconciliation polling is
 * the primary path, webhooks are an accelerator.
 */
import { paypal } from "../paypal";
import { PayPalError, type WebhookEvent } from "../paypal/client";
import { isHoldActive, type Proofhold } from "../domain/proofhold";
import {
  getProofholdByAuthorization,
  getProofholdByOrder,
  markPayPalEventProcessed,
  recordDecision,
  recordPayPalEvent,
  updateProofhold,
} from "../store/repos";
import type { Sql } from "../store/sql";
import { note, transition } from "./lifecycle";
import { completeApproval } from "./approval";

export async function reconcile(sql: Sql, ph: Proofhold): Promise<Proofhold> {
  if (!ph.paypalAuthorizationId || !isHoldActive(ph.status)) return ph;
  const pp = await paypal();
  let auth;
  try {
    auth = await pp.getAuthorization(ph.paypalAuthorizationId);
  } catch (error) {
    if (error instanceof PayPalError)
      return note(sql, ph, "reconcile_failed", { message: error.message });
    throw error;
  }
  const now = new Date().toISOString();
  switch (auth.status) {
    case "VOIDED": {
      await recordDecision(sql, {
        proofholdId: ph.id,
        outcome: "void",
        amountCents: ph.amountCents - ph.releasedCents,
        actor: "system",
        rationale: { reason: "Authorization voided at PayPal" },
        paypalCaptureId: null,
        paypalDisputeId: null,
      });
      return transition(
        sql,
        ph,
        "voided",
        { decidedAt: now, lastReconciledAt: now },
        { type: "reconciled", data: { paypalStatus: auth.status } },
      );
    }
    case "CAPTURED": {
      // Captured outside Proofhold (for example from the PayPal dashboard). Record it honestly.
      return transition(
        sql,
        ph,
        "released",
        { releasedCents: ph.amountCents, decidedAt: now, lastReconciledAt: now },
        {
          type: "reconciled",
          data: { paypalStatus: auth.status, note: "Captured outside Proofhold" },
        },
      );
    }
    case "DENIED":
      return transition(
        sql,
        ph,
        "expired",
        { decidedAt: now, lastReconciledAt: now },
        { type: "reconciled", data: { paypalStatus: auth.status } },
      );
    default:
      return updateProofhold(sql, ph.id, {
        lastReconciledAt: now,
        authorizationExpiresAt: auth.expiresAt,
      });
  }
}

export function parseWebhookEvent(raw: unknown): WebhookEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.event_type !== "string") return null;
  const resource = (
    r.resource && typeof r.resource === "object" ? r.resource : {}
  ) as Record<string, unknown>;
  return {
    id: r.id,
    eventType: r.event_type,
    resourceType: typeof r.resource_type === "string" ? r.resource_type : null,
    resourceId: typeof resource.id === "string" ? resource.id : null,
    createTime:
      typeof r.create_time === "string" ? r.create_time : new Date().toISOString(),
    resource,
    raw: r,
  };
}

/** Store the event, then act on it. Returns what happened for logging. */
export async function handleWebhookEvent(
  sql: Sql,
  event: WebhookEvent,
  verified: boolean,
): Promise<string> {
  const fresh = await recordPayPalEvent(sql, {
    eventId: event.id,
    eventType: event.eventType,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    payload: event.raw,
    verified,
  });
  if (!fresh) return "duplicate";
  if (!verified) return "stored-unverified";
  let ph: Proofhold | undefined;
  const supplementary = event.resource.supplementary_data as
    { related_ids?: { order_id?: string; authorization_id?: string } } | undefined;
  const orderId = supplementary?.related_ids?.order_id;
  const authorizationId = supplementary?.related_ids?.authorization_id;
  if (event.eventType === "CHECKOUT.ORDER.APPROVED" && event.resourceId) {
    ph = await getProofholdByOrder(sql, event.resourceId);
    if (ph?.status === "proposed") {
      await completeApproval(sql, event.resourceId);
      await markPayPalEventProcessed(sql, event.id);
      return "authorized-from-webhook";
    }
  }
  if (event.resourceType === "authorization" && event.resourceId)
    ph = await getProofholdByAuthorization(sql, event.resourceId);
  if (!ph && authorizationId)
    ph = await getProofholdByAuthorization(sql, authorizationId);
  if (!ph && orderId) ph = await getProofholdByOrder(sql, orderId);
  if (!ph) return "unmatched";
  await note(sql, ph, "webhook", { eventId: event.id, type: event.eventType });
  if (isHoldActive(ph.status)) await reconcile(sql, ph);
  await markPayPalEventProcessed(sql, event.id);
  return `reconciled:${ph.id}`;
}
