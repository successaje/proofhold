/**
 * Prove the PayPal sandbox end to end from the command line.
 *
 *   npx tsx scripts/paypal-smoke.ts            # authorize → partial capture → void remainder
 *   npx tsx scripts/paypal-smoke.ts --full     # authorize → full capture
 *
 * Reads .env.local. Prints an approval URL; open it, log in with a sandbox
 * personal account, approve, and the script continues.
 */
import { existsSync } from "node:fs";
import { PayPalRestClient } from "../src/lib/paypal/rest";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const clientId = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;
if (!clientId || !secret) {
  console.error("Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local first.");
  process.exit(1);
}
const full = process.argv.includes("--full");
const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3200";
const client = new PayPalRestClient(clientId, secret);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const order = await client.createAuthorizeOrder({
  amountCents: 2500,
  currency: "USD",
  customId: "smoke-test",
  referenceId: `smoke-${Date.now()}`,
  description: "Proofhold sandbox smoke test",
  returnUrl: `${appUrl}/api/paypal/return?smoke=1`,
  cancelUrl: `${appUrl}/api/paypal/cancel?smoke=1`,
  brandName: "Proofhold",
});
console.log(`Order ${order.orderId} created.`);
console.log(`Approve it here with a sandbox buyer account:\n  ${order.approveUrl}\n`);

let status = (await client.getOrder(order.orderId)).status;
while (status !== "APPROVED" && status !== "COMPLETED") {
  await sleep(3000);
  status = (await client.getOrder(order.orderId)).status;
  process.stdout.write(`\r  waiting for approval… (${status})   `);
}
console.log("\nApproved.");

const authorized = await client.authorizeOrder(order.orderId);
const auth = authorized.authorization;
console.log(
  `Authorization ${auth.authorizationId} status=${auth.status} amount=${auth.amountCents} expires=${auth.expiresAt}`,
);
console.log(`Payer: ${authorized.payerName ?? "?"} <${authorized.payerEmail ?? "?"}>`);

if (full) {
  const capture = await client.capture(auth.authorizationId, {
    amountCents: 2500,
    currency: "USD",
    finalCapture: true,
    noteToPayer: "Proofhold smoke test: full capture",
  });
  console.log(`Captured ${capture.captureId} status=${capture.status}`);
} else {
  const partial = await client.capture(auth.authorizationId, {
    amountCents: 1000,
    currency: "USD",
    finalCapture: false,
    noteToPayer: "Proofhold smoke test: partial capture",
  });
  console.log(`Partial capture ${partial.captureId} status=${partial.status}`);
  const after = await client.getAuthorization(auth.authorizationId);
  console.log(`Authorization now ${after.status}`);
  await client.void(auth.authorizationId);
  console.log(
    `Voided the remainder: ${(await client.getAuthorization(auth.authorizationId)).status}`,
  );
}
console.log("\nSandbox smoke test complete.");
