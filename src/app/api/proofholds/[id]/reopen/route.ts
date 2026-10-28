import { handle, json, sellerProofhold } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { reopenForResubmission } from "@/lib/proofholds/buyer";
import { sellerView } from "@/lib/view";

export const POST = handle(
  async (_req: Request, ctx: RouteContext<"/api/proofholds/[id]/reopen">) => {
    const { id } = await ctx.params;
    const updated = await reopenForResubmission(await db(), await sellerProofhold(id));
    return json({ proofhold: sellerView(updated) });
  },
);
