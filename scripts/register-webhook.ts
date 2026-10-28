/**
 * Register (or list) the PayPal sandbox webhook for a deployment.
 *
 *   npx tsx scripts/register-webhook.ts https://proofhold.onrender.com
 *   npx tsx scripts/register-webhook.ts --list
 *
 * Prints the webhook id to put in PAYPAL_WEBHOOK_ID. Reads .env.local.
 */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const clientId = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;
if (!clientId || !secret) {
  console.error("Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local first.");
  process.exit(1);
}
const base = "https://api-m.sandbox.paypal.com";
const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");
const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${basic}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
});
const { access_token } = (await tokenRes.json()) as { access_token: string };
const headers = {
  Authorization: `Bearer ${access_token}`,
  "Content-Type": "application/json",
};

if (process.argv.includes("--list")) {
  const res = await fetch(`${base}/v1/notifications/webhooks`, { headers });
  console.log(JSON.stringify(await res.json(), null, 2));
  process.exit(0);
}

const appUrl = process.argv[2] ?? process.env.APP_URL;
if (!appUrl || !appUrl.startsWith("https://")) {
  console.error(
    "Pass the public https URL of the deployment (PayPal rejects http and localhost).",
  );
  process.exit(1);
}

const events = [
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.AUTHORIZATION.CREATED",
  "PAYMENT.AUTHORIZATION.VOIDED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.PENDING",
  "PAYMENT.CAPTURE.DECLINED",
  "PAYMENT.CAPTURE.REFUNDED",
  "CUSTOMER.DISPUTE.CREATED",
  "CUSTOMER.DISPUTE.UPDATED",
  "CUSTOMER.DISPUTE.RESOLVED",
];
const res = await fetch(`${base}/v1/notifications/webhooks`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    url: `${appUrl}/api/paypal/webhook`,
    event_types: events.map((name) => ({ name })),
  }),
});
const body = (await res.json()) as { id?: string; message?: string; details?: unknown };
if (!res.ok) {
  console.error("PayPal refused:", body.message, JSON.stringify(body.details ?? body));
  process.exit(1);
}
console.log(`Webhook registered: ${body.id}`);
console.log(`Add to the environment:\n  PAYPAL_WEBHOOK_ID=${body.id}`);
