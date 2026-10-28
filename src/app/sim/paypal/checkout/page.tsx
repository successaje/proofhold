import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { paypal } from "@/lib/paypal";
import { SimulatedPayPalClient } from "@/lib/paypal/simulated";
import { db } from "@/lib/store/sql";
import { getProofholdByOrder } from "@/lib/store/repos";
import { formatMoney } from "@/lib/format";
import { SimCheckout } from "./sim-checkout";

export const metadata: Metadata = {
  title: "Simulated PayPal checkout",
  robots: { index: false },
};

export default async function SimCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const pp = await paypal();
  if (!token || !(pp instanceof SimulatedPayPalClient)) notFound();
  const order = await pp.getSimulatedOrder(token).catch(() => null);
  if (!order) notFound();
  const ph = await getProofholdByOrder(await db(), token);
  return (
    <SimCheckout
      orderId={order.id}
      amount={formatMoney(order.amountCents, order.currency)}
      merchant="Proofhold"
      description={ph?.title ?? "Proofhold"}
      customId={order.customId}
      approved={order.status !== "PAYER_ACTION_REQUIRED"}
      cancelUrl={order.cancelUrl}
      defaultEmail={ph?.buyerEmail ?? ""}
      defaultName={ph?.buyerName ?? ""}
    />
  );
}
