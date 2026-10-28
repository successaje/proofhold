import { config } from "@/lib/config";
import { paypal } from "@/lib/paypal";
import { db } from "@/lib/store/sql";
import { handleWebhookEvent, parseWebhookEvent } from "@/lib/proofholds/reconcile";

/**
 * PayPal webhook listener. Every event is verified against PayPal before it
 * changes anything; unverified events are stored for inspection only.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const event = parseWebhookEvent(body);
  if (!event) return Response.json({ error: "Not a PayPal event" }, { status: 400 });
  const h = request.headers;
  const webhookId = config().PAYPAL_WEBHOOK_ID;
  let verified = false;
  if (webhookId) {
    try {
      verified = await (
        await paypal()
      ).verifyWebhook(
        {
          transmissionId: h.get("paypal-transmission-id") ?? "",
          transmissionTime: h.get("paypal-transmission-time") ?? "",
          certUrl: h.get("paypal-cert-url") ?? "",
          authAlgo: h.get("paypal-auth-algo") ?? "",
          transmissionSig: h.get("paypal-transmission-sig") ?? "",
        },
        raw,
        webhookId,
      );
    } catch (error) {
      console.error("[webhook] verification failed", error);
    }
  }
  const result = await handleWebhookEvent(await db(), event, verified);
  return Response.json({ received: true, verified, result });
}
