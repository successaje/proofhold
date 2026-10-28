/**
 * Simulated PayPal.
 *
 * Implements the same interface as the REST client with PayPal's state rules:
 * orders need payer approval before authorization, authorizations expire after
 * 29 days, reauthorization is allowed once after the 3-day honor period,
 * captures may be partial until a final capture, and void releases whatever
 * is left. State lives in the `simulated_paypal` table so it survives restarts.
 *
 * Selected only by `PAYPAL_MODE=simulated`. The UI badges it everywhere.
 */
import { newId } from "../ids";
import { simGet, simList, simPut } from "../store/repos";
import type { Sql } from "../store/sql";
import {
  addDays,
  AUTHORIZATION_DAYS,
  HONOR_PERIOD_DAYS,
  PayPalError,
  type Authorization,
  type AuthorizedOrder,
  type Capture,
  type CaptureInput,
  type CreatedOrder,
  type CreateOrderInput,
  type Dispute,
  type EvidenceFile,
  type Money,
  type OrderDetails,
  type OrderStatus,
  type PayPalClient,
  type Refund,
  type Tracker,
  type TrackingInput,
  type WebhookHeaders,
} from "./client";

interface SimOrder {
  id: string;
  status: OrderStatus;
  amountCents: number;
  currency: string;
  customId: string;
  returnUrl: string;
  cancelUrl: string;
  payerEmail: string | null;
  payerName: string | null;
  authorizationIds: string[];
  captureIds: string[];
  trackers: Tracker[];
}

interface SimAuthorization extends Authorization {
  orderId: string;
  capturedCents: number;
  reauthorizedFrom: string | null;
  reauthorizedTo: string | null;
  finalCaptured: boolean;
}

interface SimCapture extends Capture {
  authorizationId: string;
  refundedCents: number;
}

interface SimDispute extends Dispute {
  evidence: { notes: string; files: string[] }[];
}

export class SimulatedPayPalClient implements PayPalClient {
  readonly mode = "simulated" as const;

  constructor(
    private readonly sql: Sql,
    private readonly appUrl: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async order(id: string): Promise<SimOrder> {
    const o = await simGet<SimOrder>(this.sql, "order", id);
    if (!o) throw new PayPalError("Order not found", 404, "RESOURCE_NOT_FOUND");
    return o;
  }

  private async auth(id: string): Promise<SimAuthorization> {
    const a = await simGet<SimAuthorization>(this.sql, "authorization", id);
    if (!a) throw new PayPalError("Authorization not found", 404, "RESOURCE_NOT_FOUND");
    return a;
  }

  async createAuthorizeOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    const id = newId("SIMORD", 10).toUpperCase().replace("_", "-");
    const order: SimOrder = {
      id,
      status: "PAYER_ACTION_REQUIRED",
      amountCents: input.amountCents,
      currency: input.currency,
      customId: input.customId,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
      payerEmail: null,
      payerName: null,
      authorizationIds: [],
      captureIds: [],
      trackers: [],
    };
    await simPut(this.sql, "order", id, order);
    return { orderId: id, approveUrl: `${this.appUrl}/sim/paypal/checkout?token=${id}` };
  }

  async getOrder(orderId: string): Promise<OrderDetails> {
    const o = await this.order(orderId);
    return {
      orderId: o.id,
      status: o.status,
      authorizationIds: o.authorizationIds,
      captureIds: o.captureIds,
      payerEmail: o.payerEmail,
      payerName: o.payerName,
    };
  }

  /** Simulated order details beyond the shared interface (used by the fake checkout page). */
  async getSimulatedOrder(orderId: string): Promise<SimOrder> {
    return this.order(orderId);
  }

  async simulateApproval(
    orderId: string,
    payer: { email: string; name: string },
  ): Promise<void> {
    const o = await this.order(orderId);
    if (o.status !== "PAYER_ACTION_REQUIRED" && o.status !== "CREATED")
      throw new PayPalError(
        "Order is not awaiting payer action",
        422,
        "ORDER_ALREADY_APPROVED",
      );
    o.status = "APPROVED";
    o.payerEmail = payer.email;
    o.payerName = payer.name;
    await simPut(this.sql, "order", o.id, o);
  }

  async authorizeOrder(orderId: string): Promise<AuthorizedOrder> {
    const o = await this.order(orderId);
    if (o.status === "COMPLETED" && o.authorizationIds[0]) {
      const existing = await this.auth(o.authorizationIds[0]);
      return {
        orderId,
        authorization: existing,
        payerEmail: o.payerEmail,
        payerName: o.payerName,
      };
    }
    if (o.status !== "APPROVED")
      throw new PayPalError(
        "Order has not been approved by the payer",
        422,
        "ORDER_NOT_APPROVED",
      );
    const createdAt = this.now().toISOString();
    const a: SimAuthorization = {
      authorizationId: newId("SIMAUTH", 9).toUpperCase().replace("_", "-"),
      orderId,
      status: "CREATED",
      amountCents: o.amountCents,
      currency: o.currency,
      createdAt,
      expiresAt: addDays(createdAt, AUTHORIZATION_DAYS),
      capturedCents: 0,
      reauthorizedFrom: null,
      reauthorizedTo: null,
      finalCaptured: false,
    };
    await simPut(this.sql, "authorization", a.authorizationId, a);
    o.status = "COMPLETED";
    o.authorizationIds.push(a.authorizationId);
    await simPut(this.sql, "order", o.id, o);
    return {
      orderId,
      authorization: stripAuth(a),
      payerEmail: o.payerEmail,
      payerName: o.payerName,
    };
  }

  async getAuthorization(authorizationId: string): Promise<Authorization> {
    return stripAuth(await this.auth(authorizationId));
  }

  async reauthorize(authorizationId: string, m: Money): Promise<Authorization> {
    const a = await this.auth(authorizationId);
    const now = this.now();
    const honorEnds = Date.parse(addDays(a.createdAt, HONOR_PERIOD_DAYS));
    if (now.getTime() < honorEnds)
      throw new PayPalError(
        "Reauthorization is only allowed after the 3-day honor period",
        422,
        "REAUTHORIZATION_NOT_ALLOWED_YET",
      );
    if (now.getTime() > Date.parse(a.expiresAt))
      throw new PayPalError("Authorization has expired", 422, "AUTHORIZATION_EXPIRED");
    if (a.reauthorizedTo)
      throw new PayPalError(
        "Authorization was already reauthorized once",
        422,
        "REAUTHORIZATION_LIMIT",
      );
    if (a.status !== "CREATED")
      throw new PayPalError(
        `Cannot reauthorize an authorization in status ${a.status}`,
        422,
        "AUTH_STATUS",
      );
    if (m.amountCents > a.amountCents * 1.15)
      throw new PayPalError(
        "Reauthorization amount exceeds 115% of the original",
        422,
        "AMOUNT_EXCEEDED",
      );
    const createdAt = now.toISOString();
    const next: SimAuthorization = {
      ...a,
      authorizationId: newId("SIMAUTH", 9).toUpperCase().replace("_", "-"),
      amountCents: m.amountCents,
      currency: m.currency,
      createdAt,
      expiresAt: a.expiresAt,
      reauthorizedFrom: a.authorizationId,
      reauthorizedTo: null,
    };
    a.reauthorizedTo = next.authorizationId;
    await simPut(this.sql, "authorization", a.authorizationId, a);
    await simPut(this.sql, "authorization", next.authorizationId, next);
    const o = await this.order(a.orderId);
    o.authorizationIds.push(next.authorizationId);
    await simPut(this.sql, "order", o.id, o);
    return stripAuth(next);
  }

  async capture(authorizationId: string, input: CaptureInput): Promise<Capture> {
    const a = await this.auth(authorizationId);
    const now = this.now().getTime();
    if (a.status === "VOIDED")
      throw new PayPalError("Authorization was voided", 422, "AUTHORIZATION_VOIDED");
    if (a.finalCaptured || a.status === "CAPTURED")
      throw new PayPalError(
        "Authorization has already been fully captured",
        422,
        "AUTHORIZATION_ALREADY_CAPTURED",
      );
    if (now > Date.parse(a.expiresAt))
      throw new PayPalError("Authorization has expired", 422, "AUTHORIZATION_EXPIRED");
    if (input.currency !== a.currency)
      throw new PayPalError(
        "Capture currency must match the authorization",
        422,
        "CURRENCY_MISMATCH",
      );
    if (input.amountCents <= 0)
      throw new PayPalError("Capture amount must be positive", 422, "INVALID_AMOUNT");
    if (a.capturedCents + input.amountCents > a.amountCents)
      throw new PayPalError(
        "Capture would exceed the authorized amount",
        422,
        "MAX_CAPTURE_AMOUNT_EXCEEDED",
      );
    const c: SimCapture = {
      captureId: newId("SIMCAP", 9).toUpperCase().replace("_", "-"),
      authorizationId,
      status: "COMPLETED",
      amountCents: input.amountCents,
      currency: input.currency,
      finalCapture: input.finalCapture,
      refundedCents: 0,
    };
    await simPut(this.sql, "capture", c.captureId, c);
    a.capturedCents += input.amountCents;
    a.finalCaptured = input.finalCapture || a.capturedCents >= a.amountCents;
    a.status = a.finalCaptured ? "CAPTURED" : "PARTIALLY_CAPTURED";
    await simPut(this.sql, "authorization", a.authorizationId, a);
    const o = await this.order(a.orderId);
    o.captureIds.push(c.captureId);
    await simPut(this.sql, "order", o.id, o);
    return stripCapture(c);
  }

  async void(authorizationId: string): Promise<void> {
    const a = await this.auth(authorizationId);
    if (a.status === "CAPTURED")
      throw new PayPalError(
        "A fully captured authorization cannot be voided",
        422,
        "AUTHORIZATION_ALREADY_CAPTURED",
      );
    if (a.status === "VOIDED") return;
    a.status = "VOIDED";
    await simPut(this.sql, "authorization", a.authorizationId, a);
  }

  async refund(captureId: string, m?: Money): Promise<Refund> {
    const c = await simGet<SimCapture>(this.sql, "capture", captureId);
    if (!c) throw new PayPalError("Capture not found", 404, "RESOURCE_NOT_FOUND");
    const amount = m?.amountCents ?? c.amountCents - c.refundedCents;
    if (amount <= 0 || c.refundedCents + amount > c.amountCents)
      throw new PayPalError(
        "Refund exceeds the captured amount",
        422,
        "MAX_REFUND_EXCEEDED",
      );
    c.refundedCents += amount;
    c.status = c.refundedCents >= c.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED";
    await simPut(this.sql, "capture", c.captureId, c);
    return {
      refundId: newId("SIMREF", 9).toUpperCase().replace("_", "-"),
      status: "COMPLETED",
      amountCents: amount,
      currency: c.currency,
    };
  }

  async addTracking(orderId: string, input: TrackingInput): Promise<Tracker> {
    const o = await this.order(orderId);
    if (!o.captureIds.includes(input.captureId))
      throw new PayPalError(
        "capture_id does not belong to this order",
        422,
        "INVALID_CAPTURE_ID",
      );
    const tracker: Tracker = {
      trackerId: `${input.captureId}-${input.trackingNumber}`,
      status: "SHIPPED",
      trackingNumber: input.trackingNumber,
      carrier: input.carrier,
    };
    o.trackers.push(tracker);
    await simPut(this.sql, "order", o.id, o);
    return tracker;
  }

  async cancelTracking(orderId: string, trackerId: string): Promise<void> {
    const o = await this.order(orderId);
    const t = o.trackers.find((t) => t.trackerId === trackerId);
    if (!t) throw new PayPalError("Tracker not found", 404, "RESOURCE_NOT_FOUND");
    t.status = "CANCELLED";
    await simPut(this.sql, "order", o.id, o);
  }

  async verifyWebhook(
    _h: WebhookHeaders,
    _body: string,
    _webhookId: string,
  ): Promise<boolean> {
    return false; // Simulated mode never receives PayPal webhooks.
  }

  async getDispute(disputeId: string): Promise<Dispute> {
    const d = await simGet<SimDispute>(this.sql, "dispute", disputeId);
    if (!d) throw new PayPalError("Dispute not found", 404, "RESOURCE_NOT_FOUND");
    const { evidence: _e, ...rest } = d;
    return rest;
  }

  async provideEvidence(
    disputeId: string,
    notes: string,
    files: EvidenceFile[],
  ): Promise<void> {
    const d = await simGet<SimDispute>(this.sql, "dispute", disputeId);
    if (!d) throw new PayPalError("Dispute not found", 404, "RESOURCE_NOT_FOUND");
    d.evidence.push({ notes, files: files.map((f) => f.name) });
    d.status = "UNDER_REVIEW";
    d.actions = ["adjudicate", "send-message"];
    await simPut(this.sql, "dispute", d.disputeId, d);
  }

  async requireEvidence(disputeId: string, action: "BUYER_EVIDENCE" | "SELLER_EVIDENCE") {
    const d = await simGet<SimDispute>(this.sql, "dispute", disputeId);
    if (!d) throw new PayPalError("Dispute not found", 404, "RESOURCE_NOT_FOUND");
    d.status =
      action === "BUYER_EVIDENCE"
        ? "WAITING_FOR_BUYER_RESPONSE"
        : "WAITING_FOR_SELLER_RESPONSE";
    d.actions = ["provide-evidence", "send-message", "accept-claim"];
    await simPut(this.sql, "dispute", d.disputeId, d);
  }

  async adjudicate(
    disputeId: string,
    outcome: "BUYER_FAVOR" | "SELLER_FAVOR",
  ): Promise<void> {
    const d = await simGet<SimDispute>(this.sql, "dispute", disputeId);
    if (!d) throw new PayPalError("Dispute not found", 404, "RESOURCE_NOT_FOUND");
    d.status = "RESOLVED";
    d.outcome =
      outcome === "BUYER_FAVOR" ? "RESOLVED_BUYER_FAVOUR" : "RESOLVED_SELLER_FAVOUR";
    d.actions = [];
    await simPut(this.sql, "dispute", d.disputeId, d);
  }

  async createSandboxDispute(input: {
    buyerTransactionId: string;
    buyerEmail: string;
    reason:
      "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" | "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED";
    money: Money;
  }): Promise<Dispute> {
    const d: SimDispute = {
      disputeId: `PP-D-${Math.floor(10000 + Math.random() * 89999)}`,
      status: "WAITING_FOR_SELLER_RESPONSE",
      reason: input.reason,
      outcome: null,
      amountCents: input.money.amountCents,
      currency: input.money.currency,
      actions: ["provide-evidence", "send-message", "accept-claim", "make-offer"],
      evidence: [],
    };
    await simPut(this.sql, "dispute", d.disputeId, d);
    return this.getDispute(d.disputeId);
  }

  /** Test and debugging helper. */
  async listAuthorizations(): Promise<Authorization[]> {
    return (await simList<SimAuthorization>(this.sql, "authorization")).map(stripAuth);
  }
}

function stripAuth(a: SimAuthorization): Authorization {
  return {
    authorizationId: a.authorizationId,
    status: a.status,
    amountCents: a.amountCents,
    currency: a.currency,
    expiresAt: a.expiresAt,
    createdAt: a.createdAt,
  };
}

function stripCapture(c: SimCapture): Capture {
  return {
    captureId: c.captureId,
    status: c.status,
    amountCents: c.amountCents,
    currency: c.currency,
    finalCapture: c.finalCapture,
  };
}
