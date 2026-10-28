import { z } from "zod";
import { handle, json, readJson, sellerProofhold } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { proposeOffer } from "@/lib/proofholds/buyer";
import { sellerView } from "@/lib/view";

const schema = z.object({
  amountCents: z.number().int().positive(),
  note: z.string().max(2000).default(""),
});

export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/proofholds/[id]/offer">) => {
    const { id } = await ctx.params;
    const ph = await sellerProofhold(id);
    const updated = await proposeOffer(
      await db(),
      ph,
      schema.parse(await readJson(request)),
    );
    return json({ proofhold: sellerView(updated) });
  },
);
