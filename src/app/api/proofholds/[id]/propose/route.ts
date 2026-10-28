import { handle, json, sellerProofhold } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { propose } from "@/lib/proofholds/compose";
import { sellerView } from "@/lib/view";

export const POST = handle(
  async (_req: Request, ctx: RouteContext<"/api/proofholds/[id]/propose">) => {
    const { id } = await ctx.params;
    const ph = await propose(await db(), await sellerProofhold(id));
    return json({ proofhold: sellerView(ph) });
  },
);
