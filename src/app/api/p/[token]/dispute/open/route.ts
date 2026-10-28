import { z } from "zod";
import { buyerProofhold, handle, json, readJson } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { openSandboxDispute } from "@/lib/proofholds/disputes";
import { proofholdView } from "@/lib/view";

const schema = z.object({
  reason: z.enum([
    "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
  ]),
  buyerTransactionId: z.string().max(60).optional().nullable(),
  buyerEmail: z.string().email().optional().nullable(),
});

/** Sandbox only: the buyer opens a PayPal dispute against the capture. */
export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/p/[token]/dispute/open">) => {
    const { token } = await ctx.params;
    const input = schema.parse(await readJson(request));
    const updated = await openSandboxDispute(
      await db(),
      await buyerProofhold(token),
      input,
    );
    return json({ proofhold: proofholdView(updated) });
  },
);
