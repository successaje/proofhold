import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../../src/lib/store/sql";
import { SimulatedPayPalClient } from "../../src/lib/paypal/simulated";
import { PayPalError, addDays } from "../../src/lib/paypal/client";
import { authAssertion } from "../../src/lib/paypal/rest";

async function setup() {
  const sql = await openDatabase({ sqlitePath: ":memory:" });
  let now = new Date("2026-11-01T10:00:00.000Z");
  const client = new SimulatedPayPalClient(sql, "http://127.0.0.1:3200", () => now);
  const advance = (days: number) => {
    now = new Date(now.getTime() + days * 86_400_000);
  };
  const order = await client.createAuthorizeOrder({
    amountCents: 42000,
    currency: "USD",
    customId: "hash",
    referenceId: "ph_1",
    description: "Logo set",
    returnUrl: "http://127.0.0.1:3200/return",
    cancelUrl: "http://127.0.0.1:3200/cancel",
    brandName: "Proofhold",
  });
  return { sql, client, order, advance };
}

test("order must be approved before it can be authorized", async () => {
  const { client, order } = await setup();
  assert.match(order.approveUrl, /\/sim\/paypal\/checkout\?token=/);
  await assert.rejects(
    () => client.authorizeOrder(order.orderId),
    (e: PayPalError) => e.name_ === "ORDER_NOT_APPROVED",
  );
  await client.simulateApproval(order.orderId, {
    email: "buyer@example.com",
    name: "Bea Buyer",
  });
  const authorized = await client.authorizeOrder(order.orderId);
  assert.equal(authorized.authorization.status, "CREATED");
  assert.equal(authorized.authorization.amountCents, 42000);
  assert.equal(authorized.payerEmail, "buyer@example.com");
  assert.equal(
    authorized.authorization.expiresAt,
    addDays("2026-11-01T10:00:00.000Z", 29),
  );
  const again = await client.authorizeOrder(order.orderId);
  assert.equal(
    again.authorization.authorizationId,
    authorized.authorization.authorizationId,
  );
});

test("partial captures accumulate until a final capture; void releases the rest", async () => {
  const { client, order } = await setup();
  await client.simulateApproval(order.orderId, { email: "b@example.com", name: "B" });
  const { authorization } = await client.authorizeOrder(order.orderId);
  const first = await client.capture(authorization.authorizationId, {
    amountCents: 28000,
    currency: "USD",
    finalCapture: false,
  });
  assert.equal(first.status, "COMPLETED");
  assert.equal(
    (await client.getAuthorization(authorization.authorizationId)).status,
    "PARTIALLY_CAPTURED",
  );
  await assert.rejects(
    () =>
      client.capture(authorization.authorizationId, {
        amountCents: 20000,
        currency: "USD",
        finalCapture: true,
      }),
    (e: PayPalError) => e.name_ === "MAX_CAPTURE_AMOUNT_EXCEEDED",
  );
  await client.void(authorization.authorizationId);
  assert.equal(
    (await client.getAuthorization(authorization.authorizationId)).status,
    "VOIDED",
  );
  await assert.rejects(
    () =>
      client.capture(authorization.authorizationId, {
        amountCents: 100,
        currency: "USD",
        finalCapture: true,
      }),
    (e: PayPalError) => e.name_ === "AUTHORIZATION_VOIDED",
  );
  const refund = await client.refund(first.captureId, {
    amountCents: 1000,
    currency: "USD",
  });
  assert.equal(refund.amountCents, 1000);
});

test("reauthorization only after the honor period, only once, never after expiry", async () => {
  const { client, order, advance } = await setup();
  await client.simulateApproval(order.orderId, { email: "b@example.com", name: "B" });
  const { authorization } = await client.authorizeOrder(order.orderId);
  await assert.rejects(
    () =>
      client.reauthorize(authorization.authorizationId, {
        amountCents: 42000,
        currency: "USD",
      }),
    (e: PayPalError) => e.name_ === "REAUTHORIZATION_NOT_ALLOWED_YET",
  );
  advance(4);
  const next = await client.reauthorize(authorization.authorizationId, {
    amountCents: 42000,
    currency: "USD",
  });
  assert.notEqual(next.authorizationId, authorization.authorizationId);
  await assert.rejects(
    () =>
      client.reauthorize(authorization.authorizationId, {
        amountCents: 42000,
        currency: "USD",
      }),
    (e: PayPalError) => e.name_ === "REAUTHORIZATION_LIMIT",
  );
  advance(30);
  await assert.rejects(
    () =>
      client.capture(next.authorizationId, {
        amountCents: 42000,
        currency: "USD",
        finalCapture: true,
      }),
    (e: PayPalError) => e.name_ === "AUTHORIZATION_EXPIRED",
  );
});

test("tracking requires a capture on the order", async () => {
  const { client, order } = await setup();
  await client.simulateApproval(order.orderId, { email: "b@example.com", name: "B" });
  const { authorization } = await client.authorizeOrder(order.orderId);
  await assert.rejects(
    () =>
      client.addTracking(order.orderId, {
        captureId: "nope",
        trackingNumber: "1Z999",
        carrier: "UPS",
        notifyPayer: false,
      }),
    (e: PayPalError) => e.name_ === "INVALID_CAPTURE_ID",
  );
  const capture = await client.capture(authorization.authorizationId, {
    amountCents: 42000,
    currency: "USD",
    finalCapture: true,
  });
  const tracker = await client.addTracking(order.orderId, {
    captureId: capture.captureId,
    trackingNumber: "1Z999AA10123456784",
    carrier: "UPS",
    notifyPayer: true,
  });
  assert.equal(tracker.status, "SHIPPED");
  const details = await client.getOrder(order.orderId);
  assert.deepEqual(details.captureIds, [capture.captureId]);
});

test("sandbox dispute lifecycle in the simulator", async () => {
  const { client } = await setup();
  const d = await client.createSandboxDispute({
    buyerTransactionId: "TX1",
    buyerEmail: "b@example.com",
    reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
    money: { amountCents: 42000, currency: "USD" },
  });
  assert.ok(d.actions.includes("provide-evidence"));
  await client.provideEvidence(d.disputeId, "Evidence bundle", []);
  assert.equal((await client.getDispute(d.disputeId)).status, "UNDER_REVIEW");
  await client.adjudicate(d.disputeId, "SELLER_FAVOR");
  const resolved = await client.getDispute(d.disputeId);
  assert.equal(resolved.status, "RESOLVED");
  assert.equal(resolved.outcome, "RESOLVED_SELLER_FAVOUR");
});

test("auth assertion is an unsigned JWT naming the client and buyer", () => {
  const [header, payload, sig] = authAssertion("CLIENT", "buyer@example.com").split(".");
  assert.equal(JSON.parse(Buffer.from(header!, "base64url").toString()).alg, "none");
  assert.deepEqual(JSON.parse(Buffer.from(payload!, "base64url").toString()), {
    iss: "CLIENT",
    email: "buyer@example.com",
  });
  assert.equal(sig, "");
});
