import { z } from "zod";
import { handle, json, readJson, sellerProofhold } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { addTracking } from "@/lib/proofholds/evidence";

const schema = z.object({
  carrier: z.string().min(2).max(40),
  number: z.string().min(4).max(60),
});

export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/proofholds/[id]/tracking">) => {
    const { id } = await ctx.params;
    const ph = await sellerProofhold(id);
    const item = await addTracking(await db(), ph, schema.parse(await readJson(request)));
    return json({ evidence: item }, { status: 201 });
  },
);
