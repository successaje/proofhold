/**
 * PayPal REST client (sandbox).
 *
 * - Client-credentials token cached in memory, refreshed early and on 401.
 * - `PayPal-Request-Id` on every mutating call so retries are idempotent.
 * - Responses are validated with zod before Proofhold trusts them.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  addDays,
  AUTHORIZATION_DAYS,
  moneyCents,
  moneyValue,
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
  type PayPalClient,
  type Refund,
  type Tracker,
  type TrackingInput,
  type WebhookHeaders,
} from "./client";

const SANDBOX = "https://api-m.sandbox.paypal.com";

const link = z.object({
  href: z.string(),
  rel: z.string(),
  method: z.string().optional(),
});
const money = z.object({ currency_code: z.string(), value: z.string() });

const authorizationSchema = z.object({
  id: z.string(),
  status: z.enum([
    "CREATED",
    "CAPTURED",
    "DENIED",
    "PARTIALLY_CAPTURED",
    "VOIDED",
    "PENDING",
  ]),
  amount: money,
  expiration_time: z.string().optional(),
  create_time: z.string().optional(),
});

const captureSchema = z.object({
  id: z.string(),
  status: z.enum([
    "COMPLETED",
    "DECLINED",
    "PARTIALLY_REFUNDED",
    "PENDING",
    "REFUNDED",
    "FAILED",
  ]),
  amount: money.optional(),
  final_capture: z.boolean().optional(),
});

const orderSchema = z.object({
  id: z.string(),
  status: z.enum([
    "CREATED",
    "SAVED",
    "APPROVED",
    "VOIDED",
    "COMPLETED",
    "PAYER_ACTION_REQUIRED",
  ]),
  links: z.array(link).optional(),
  payer: z
    .object({
      email_address: z.string().optional(),
      name: z
        .object({ given_name: z.string().optional(), surname: z.string().optional() })
        .optional(),
    })
    .optional(),
  payment_source: z
    .object({
      paypal: z
        .object({
          email_address: z.string().optional(),
          name: z
            .object({ given_name: z.string().optional(), surname: z.string().optional() })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  purchase_units: z
    .array(
      z.object({
        payments: z
          .object({
            authorizations: z.array(authorizationSchema).optional(),
            captures: z.array(captureSchema).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

const disputeSchema = z.object({
  dispute_id: z.string(),
  status: z.enum([
    "OPEN",
    "WAITING_FOR_BUYER_RESPONSE",
    "WAITING_FOR_SELLER_RESPONSE",
    "UNDER_REVIEW",
    "RESOLVED",
    "OTHER",
  ]),
  reason: z.string().optional(),
  dispute_amount: money.optional(),
  dispute_outcome: z.object({ outcome_code: z.string().optional() }).optional(),
  links: z.array(link).optional(),
});

interface Token {
  value: string;
  expiresAt: number;
}

export class PayPalRestClient implements PayPalClient {
  readonly mode = "sandbox" as const;
  private token: Token | undefined;
  private tokenPromise: Promise<Token> | undefined;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly baseUrl: string = SANDBOX,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  // ---------- auth ----------

  private async accessToken(force = false): Promise<string> {
    if (!force && this.token && this.token.expiresAt > Date.now() + 60_000)
      return this.token.value;
    this.tokenPromise ??= this.fetchToken().finally(
      () => (this.tokenPromise = undefined),
    );
    this.token = await this.tokenPromise;
    return this.token.value;
  }

  private async fetchToken(): Promise<Token> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await this.fetchImpl(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok)
      throw new PayPalError(`PayPal token request failed (${res.status})`, res.status);
    const body = z
      .object({ access_token: z.string(), expires_in: z.number() })
      .parse(await res.json());
    return { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  }

  private async request(
    method: "GET" | "POST" | "PATCH",
    path: string,
    options: {
      json?: unknown;
      form?: FormData;
      headers?: Record<string, string>;
      idempotent?: boolean;
      retry?: boolean;
    } = {},
  ): Promise<{ status: number; body: unknown; headers: Headers }> {
    const token = await this.accessToken(options.retry === true);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Prefer: "return=representation",
      ...options.headers,
    };
    let body: BodyInit | undefined;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    } else if (options.form) {
      body = options.form;
    }
    if (method !== "GET" && options.idempotent !== false)
      headers["PayPal-Request-Id"] = randomUUID();
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, { method, headers, body });
    if (res.status === 401 && !options.retry)
      return this.request(method, path, { ...options, retry: true });
    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!res.ok) {
      const detail = (parsed ?? {}) as {
        name?: string;
        message?: string;
        details?: unknown;
      };
      throw new PayPalError(
        detail.message
          ? `PayPal: ${detail.message}`
          : `PayPal request failed (${res.status})`,
        res.status,
        detail.name ?? null,
        detail.details ?? parsed,
      );
    }
    return { status: res.status, body: parsed, headers: res.headers };
  }

  // ---------- orders ----------

  async createAuthorizeOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    const { body } = await this.request("POST", "/v2/checkout/orders", {
      json: {
        intent: "AUTHORIZE",
        purchase_units: [
          {
            reference_id: input.referenceId,
            custom_id: input.customId,
            description: input.description.slice(0, 127),
            amount: {
              currency_code: input.currency,
              value: moneyValue(input.amountCents),
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: input.brandName,
              user_action: "PAY_NOW",
              shipping_preference: "NO_SHIPPING",
              return_url: input.returnUrl,
              cancel_url: input.cancelUrl,
            },
          },
        },
      },
    });
    const order = orderSchema.parse(body);
    const approve = order.links?.find(
      (l) => l.rel === "payer-action" || l.rel === "approve",
    );
    if (!approve)
      throw new PayPalError("PayPal returned no approval link for the order", 502);
    return { orderId: order.id, approveUrl: approve.href };
  }

  async getOrder(orderId: string): Promise<OrderDetails> {
    const { body } = await this.request("GET", `/v2/checkout/orders/${orderId}`);
    return toOrderDetails(orderSchema.parse(body));
  }

  async authorizeOrder(orderId: string): Promise<AuthorizedOrder> {
    const { body } = await this.request(
      "POST",
      `/v2/checkout/orders/${orderId}/authorize`,
      {
        json: {},
      },
    );
    const order = orderSchema.parse(body);
    const auth = order.purchase_units?.[0]?.payments?.authorizations?.[0];
    if (!auth)
      throw new PayPalError(
        "PayPal authorized the order but returned no authorization",
        502,
      );
    const details = toOrderDetails(order);
    return {
      orderId: order.id,
      authorization: toAuthorization(auth),
      payerEmail: details.payerEmail,
      payerName: details.payerName,
    };
  }

  // ---------- authorizations ----------

  async getAuthorization(authorizationId: string): Promise<Authorization> {
    const { body } = await this.request(
      "GET",
      `/v2/payments/authorizations/${authorizationId}`,
    );
    return toAuthorization(authorizationSchema.parse(body));
  }

  async reauthorize(authorizationId: string, m: Money): Promise<Authorization> {
    const { body } = await this.request(
      "POST",
      `/v2/payments/authorizations/${authorizationId}/reauthorize`,
      {
        json: { amount: { currency_code: m.currency, value: moneyValue(m.amountCents) } },
      },
    );
    return toAuthorization(authorizationSchema.parse(body));
  }

  async capture(authorizationId: string, input: CaptureInput): Promise<Capture> {
    const { body } = await this.request(
      "POST",
      `/v2/payments/authorizations/${authorizationId}/capture`,
      {
        json: {
          amount: { currency_code: input.currency, value: moneyValue(input.amountCents) },
          final_capture: input.finalCapture,
          invoice_id: input.invoiceId,
          note_to_payer: input.noteToPayer?.slice(0, 255),
        },
      },
    );
    const c = captureSchema.parse(body);
    return {
      captureId: c.id,
      status: c.status,
      amountCents: c.amount ? moneyCents(c.amount.value) : input.amountCents,
      currency: c.amount?.currency_code ?? input.currency,
      finalCapture: c.final_capture ?? input.finalCapture,
    };
  }

  async void(authorizationId: string): Promise<void> {
    await this.request("POST", `/v2/payments/authorizations/${authorizationId}/void`);
  }

  async refund(captureId: string, m?: Money): Promise<Refund> {
    const { body } = await this.request(
      "POST",
      `/v2/payments/captures/${captureId}/refund`,
      {
        json: m
          ? { amount: { currency_code: m.currency, value: moneyValue(m.amountCents) } }
          : {},
      },
    );
    const r = z
      .object({
        id: z.string(),
        status: z.enum(["CANCELLED", "FAILED", "PENDING", "COMPLETED"]),
        amount: money.optional(),
      })
      .parse(body);
    return {
      refundId: r.id,
      status: r.status,
      amountCents: r.amount ? moneyCents(r.amount.value) : (m?.amountCents ?? 0),
      currency: r.amount?.currency_code ?? m?.currency ?? "USD",
    };
  }

  // ---------- tracking ----------

  async addTracking(orderId: string, input: TrackingInput): Promise<Tracker> {
    const { body } = await this.request("POST", `/v2/checkout/orders/${orderId}/track`, {
      json: {
        capture_id: input.captureId,
        tracking_number: input.trackingNumber,
        carrier: input.carrier,
        notify_payer: input.notifyPayer,
      },
    });
    const order = orderSchema.extend({
      purchase_units: z
        .array(
          z.object({
            shipping: z
              .object({
                trackers: z
                  .array(
                    z.object({
                      id: z.string(),
                      status: z.enum(["SHIPPED", "CANCELLED"]).optional(),
                    }),
                  )
                  .optional(),
              })
              .optional(),
          }),
        )
        .optional(),
    });
    const parsed = order.parse(body);
    const trackers = parsed.purchase_units?.[0]?.shipping?.trackers ?? [];
    const tracker =
      trackers.find((t) => t.id.includes(input.trackingNumber)) ??
      trackers[trackers.length - 1];
    if (!tracker)
      throw new PayPalError(
        "PayPal accepted the tracker but returned no tracker id",
        502,
      );
    return {
      trackerId: tracker.id,
      status: tracker.status ?? "SHIPPED",
      trackingNumber: input.trackingNumber,
      carrier: input.carrier,
    };
  }

  async cancelTracking(orderId: string, trackerId: string): Promise<void> {
    await this.request("PATCH", `/v2/checkout/orders/${orderId}/trackers/${trackerId}`, {
      json: [{ op: "replace", path: "/status", value: "CANCELLED" }],
    });
  }

  // ---------- webhooks ----------

  async verifyWebhook(
    h: WebhookHeaders,
    rawBody: string,
    webhookId: string,
  ): Promise<boolean> {
    const { body } = await this.request(
      "POST",
      "/v1/notifications/verify-webhook-signature",
      {
        json: {
          auth_algo: h.authAlgo,
          cert_url: h.certUrl,
          transmission_id: h.transmissionId,
          transmission_sig: h.transmissionSig,
          transmission_time: h.transmissionTime,
          webhook_id: webhookId,
          webhook_event: JSON.parse(rawBody),
        },
        idempotent: false,
      },
    );
    return (
      z.object({ verification_status: z.string() }).parse(body).verification_status ===
      "SUCCESS"
    );
  }

  // ---------- disputes ----------

  async getDispute(disputeId: string): Promise<Dispute> {
    const { body } = await this.request("GET", `/v1/customer/disputes/${disputeId}`);
    return toDispute(disputeSchema.parse(body));
  }

  async provideEvidence(
    disputeId: string,
    notes: string,
    files: EvidenceFile[],
  ): Promise<void> {
    const form = new FormData();
    form.append(
      "input",
      new Blob(
        [
          JSON.stringify({
            evidences: [{ evidence_type: "OTHER", notes: notes.slice(0, 2000) }],
          }),
        ],
        {
          type: "application/json",
        },
      ),
    );
    for (const f of files)
      form.append(
        "evidence-file",
        new Blob([f.bytes as BlobPart], { type: f.mime }),
        f.name,
      );
    await this.request("POST", `/v1/customer/disputes/${disputeId}/provide-evidence`, {
      form,
    });
  }

  async requireEvidence(disputeId: string, action: "BUYER_EVIDENCE" | "SELLER_EVIDENCE") {
    await this.request("POST", `/v1/customer/disputes/${disputeId}/require-evidence`, {
      json: { action },
    });
  }

  async adjudicate(
    disputeId: string,
    outcome: "BUYER_FAVOR" | "SELLER_FAVOR",
  ): Promise<void> {
    await this.request("POST", `/v1/customer/disputes/${disputeId}/adjudicate`, {
      json: { adjudication_outcome: outcome },
    });
  }

  async createSandboxDispute(input: {
    buyerTransactionId: string;
    buyerEmail: string;
    reason:
      "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" | "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED";
    money: Money;
  }): Promise<Dispute> {
    const form = new FormData();
    form.append(
      "input",
      new Blob(
        [
          JSON.stringify({
            disputed_transactions: [{ buyer_transaction_id: input.buyerTransactionId }],
            reason: input.reason,
            dispute_amount: {
              currency_code: input.money.currency,
              value: moneyValue(input.money.amountCents),
            },
            extensions: {
              merchant_contacted: true,
              merchant_contacted_outcome: "NO_RESPONSE",
              merchandize_dispute_properties: { issue_type: "PRODUCT" },
            },
          }),
        ],
        { type: "application/json" },
      ),
    );
    const { body } = await this.request("POST", "/v1/customer/disputes", {
      form,
      headers: {
        "PayPal-Auth-Assertion": authAssertion(this.clientId, input.buyerEmail),
      },
    });
    const created = z
      .object({ links: z.array(link).optional(), dispute_id: z.string().optional() })
      .parse(body);
    const self = created.links?.find((l) => l.rel === "self")?.href ?? "";
    const disputeId = created.dispute_id ?? self.split("/").pop();
    if (!disputeId)
      throw new PayPalError("PayPal created the dispute but returned no id", 502);
    return this.getDispute(disputeId);
  }
}

/** `PayPal-Auth-Assertion`: an unsigned JWT naming the client and the acting buyer. */
export function authAssertion(clientId: string, email: string): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${enc({ alg: "none" })}.${enc({ iss: clientId, email })}.`;
}

function toAuthorization(a: z.infer<typeof authorizationSchema>): Authorization {
  const createdAt = a.create_time ?? new Date().toISOString();
  return {
    authorizationId: a.id,
    status: a.status,
    amountCents: moneyCents(a.amount.value),
    currency: a.amount.currency_code,
    expiresAt: a.expiration_time ?? addDays(createdAt, AUTHORIZATION_DAYS),
    createdAt,
  };
}

function toOrderDetails(o: z.infer<typeof orderSchema>): OrderDetails {
  const payer = o.payer ?? o.payment_source?.paypal;
  const name = payer?.name
    ? [payer.name.given_name, payer.name.surname].filter(Boolean).join(" ")
    : "";
  const payments = o.purchase_units?.[0]?.payments;
  return {
    orderId: o.id,
    status: o.status,
    authorizationIds: payments?.authorizations?.map((a) => a.id) ?? [],
    captureIds: payments?.captures?.map((c) => c.id) ?? [],
    payerEmail: payer?.email_address ?? null,
    payerName: name || null,
  };
}

function toDispute(d: z.infer<typeof disputeSchema>): Dispute {
  return {
    disputeId: d.dispute_id,
    status: d.status,
    reason: d.reason ?? null,
    outcome: d.dispute_outcome?.outcome_code ?? null,
    amountCents: d.dispute_amount ? moneyCents(d.dispute_amount.value) : null,
    currency: d.dispute_amount?.currency_code ?? null,
    actions: (d.links ?? []).map((l) => l.rel).filter((r) => r !== "self"),
  };
}
