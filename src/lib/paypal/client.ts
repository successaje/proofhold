/**
 * The PayPal surface Proofhold depends on, expressed in Proofhold's terms.
 *
 * Two implementations exist: `rest.ts` (PayPal sandbox over HTTPS) and
 * `simulated.ts` (in process, same state rules). Everything above this
 * interface is identical in both modes, and the UI badges which one is live.
 */

export type PayPalMode = "sandbox" | "simulated";

export interface Money {
  amountCents: number;
  currency: string;
}

export interface CreateOrderInput extends Money {
  /** Bound to the acceptance test: sha256 of the canonical test JSON. */
  customId: string;
  referenceId: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  brandName: string;
}

export interface CreatedOrder {
  orderId: string;
  /** Where the buyer goes to approve the hold. */
  approveUrl: string;
}

export type OrderStatus =
  "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";

export interface OrderDetails {
  orderId: string;
  status: OrderStatus;
  authorizationIds: string[];
  captureIds: string[];
  payerEmail: string | null;
  payerName: string | null;
}

export type AuthorizationStatus =
  "CREATED" | "CAPTURED" | "DENIED" | "PARTIALLY_CAPTURED" | "VOIDED" | "PENDING";

export interface Authorization extends Money {
  authorizationId: string;
  status: AuthorizationStatus;
  /** PayPal's `expiration_time`: 29 days after creation. */
  expiresAt: string;
  createdAt: string;
}

export interface AuthorizedOrder {
  orderId: string;
  authorization: Authorization;
  payerEmail: string | null;
  payerName: string | null;
}

export type CaptureStatus =
  "COMPLETED" | "DECLINED" | "PARTIALLY_REFUNDED" | "PENDING" | "REFUNDED" | "FAILED";

export interface Capture extends Money {
  captureId: string;
  status: CaptureStatus;
  finalCapture: boolean;
}

export interface CaptureInput extends Money {
  finalCapture: boolean;
  invoiceId?: string;
  noteToPayer?: string;
}

export interface Tracker {
  trackerId: string;
  status: "SHIPPED" | "CANCELLED";
  trackingNumber: string;
  carrier: string;
}

export interface TrackingInput {
  captureId: string;
  trackingNumber: string;
  carrier: string;
  notifyPayer: boolean;
}

export interface Refund extends Money {
  refundId: string;
  status: "CANCELLED" | "FAILED" | "PENDING" | "COMPLETED";
}

export type DisputeStatus =
  | "OPEN"
  | "WAITING_FOR_BUYER_RESPONSE"
  | "WAITING_FOR_SELLER_RESPONSE"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "OTHER";

export interface Dispute {
  disputeId: string;
  status: DisputeStatus;
  reason: string | null;
  outcome: string | null;
  amountCents: number | null;
  currency: string | null;
  /** HATEOAS link rels PayPal currently allows, e.g. provide-evidence, adjudicate. */
  actions: string[];
}

export interface EvidenceFile {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export interface WebhookHeaders {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
}

export interface WebhookEvent {
  id: string;
  eventType: string;
  resourceType: string | null;
  resourceId: string | null;
  createTime: string;
  resource: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export class PayPalError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly name_: string | null = null,
    public readonly details: unknown = null,
  ) {
    super(message);
  }
}

export interface PayPalClient {
  readonly mode: PayPalMode;

  createAuthorizeOrder(input: CreateOrderInput): Promise<CreatedOrder>;
  getOrder(orderId: string): Promise<OrderDetails>;
  authorizeOrder(orderId: string): Promise<AuthorizedOrder>;

  getAuthorization(authorizationId: string): Promise<Authorization>;
  /** Allowed once, after the 3-day honor period and before day 29. Returns the new authorization. */
  reauthorize(authorizationId: string, money: Money): Promise<Authorization>;
  capture(authorizationId: string, input: CaptureInput): Promise<Capture>;
  void(authorizationId: string): Promise<void>;
  refund(captureId: string, money?: Money): Promise<Refund>;

  /** Requires a capture id: PayPal only attaches tracking to captured orders. */
  addTracking(orderId: string, input: TrackingInput): Promise<Tracker>;
  cancelTracking(orderId: string, trackerId: string): Promise<void>;

  verifyWebhook(
    headers: WebhookHeaders,
    rawBody: string,
    webhookId: string,
  ): Promise<boolean>;

  getDispute(disputeId: string): Promise<Dispute>;
  provideEvidence(disputeId: string, notes: string, files: EvidenceFile[]): Promise<void>;
  /** Sandbox only. */
  requireEvidence(
    disputeId: string,
    action: "BUYER_EVIDENCE" | "SELLER_EVIDENCE",
  ): Promise<void>;
  /** Sandbox only. */
  adjudicate(disputeId: string, outcome: "BUYER_FAVOR" | "SELLER_FAVOR"): Promise<void>;
  /** Sandbox only: opens a dispute as the buyer against a captured transaction. */
  createSandboxDispute(input: {
    buyerTransactionId: string;
    buyerEmail: string;
    reason:
      "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" | "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED";
    money: Money;
  }): Promise<Dispute>;

  /** Simulated mode only: stands in for the buyer approving on PayPal. */
  simulateApproval?(
    orderId: string,
    payer: { email: string; name: string },
  ): Promise<void>;
}

export function moneyValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function moneyCents(value: string): number {
  return Math.round(Number(value) * 100);
}

export const HONOR_PERIOD_DAYS = 3;
export const AUTHORIZATION_DAYS = 29;

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}
