import { handle, json, sellerProofhold } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { cancel } from "@/lib/proofholds/compose";
import { sellerView } from "@/lib/view";

export const POST = handle(
  async (_req: Request, ctx: RouteContext<"/api/proofholds/[id]/cancel">) => {
    const { id } = await ctx.params;
    const ph = await cancel(await db(), await sellerProofhold(id), "seller");
    return json({ proofhold: sellerView(ph) });
  },
);
