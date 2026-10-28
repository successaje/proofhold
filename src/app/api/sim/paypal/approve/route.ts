import { z } from "zod";
import { config } from "@/lib/config";
import { paypal } from "@/lib/paypal";
import { HttpError, handle, readJson } from "@/lib/http";

const schema = z.object({
  orderId: z.string().min(3),
  email: z.string().email(),
  name: z.string().min(1).max(80),
});

/** Simulated PayPal only: the fake checkout page posts here, then returns like PayPal would. */
export const POST = handle(async (request: Request) => {
  const pp = await paypal();
  if (pp.mode !== "simulated" || !pp.simulateApproval)
    throw new HttpError("Not available in sandbox mode.", 404);
  const input = schema.parse(await readJson(request));
  await pp.simulateApproval(input.orderId, { email: input.email, name: input.name });
  const base = config().APP_URL;
  return Response.json({
    returnUrl: `${base}/api/paypal/return?token=${encodeURIComponent(input.orderId)}`,
  });
});
