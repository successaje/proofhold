import { config } from "../config";
import { db } from "../store/sql";
import type { PayPalClient } from "./client";
import { PayPalRestClient } from "./rest";
import { SimulatedPayPalClient } from "./simulated";

let instance: Promise<PayPalClient> | undefined;

/** The process-wide PayPal client, chosen by configuration. */
export function paypal(): Promise<PayPalClient> {
  instance ??= (async () => {
    const c = config();
    if (c.paypal.mode === "sandbox")
      return new PayPalRestClient(c.PAYPAL_CLIENT_ID!, c.PAYPAL_CLIENT_SECRET!);
    return new SimulatedPayPalClient(await db(), c.APP_URL);
  })();
  return instance;
}

export type { PayPalClient } from "./client";
