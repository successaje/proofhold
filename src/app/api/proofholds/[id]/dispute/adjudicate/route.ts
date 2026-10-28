import { z } from "zod";
import { handle, json, readJson, sellerProofhold } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { adjudicate } from "@/lib/proofholds/disputes";
import { sellerView } from "@/lib/view";

const schema = z.object({ outcome: z.enum(["BUYER_FAVOR", "SELLER_FAVOR"]) });

/** Sandbox only: stands in for PayPal's decision. */
export const POST = handle(
  async (
    request: Request,
    ctx: RouteContext<"/api/proofholds/[id]/dispute/adjudicate">,
  ) => {
    const { id } = await ctx.params;
    const input = schema.parse(await readJson(request));
    const updated = await adjudicate(
      await db(),
      await sellerProofhold(id),
      input.outcome,
    );
    return json({ proofhold: sellerView(updated) });
  },
);
