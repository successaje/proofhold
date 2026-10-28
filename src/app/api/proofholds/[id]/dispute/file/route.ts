import { handle, json, sellerProofhold } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { fileEvidence } from "@/lib/proofholds/disputes";
import { sellerView } from "@/lib/view";

export const POST = handle(
  async (_req: Request, ctx: RouteContext<"/api/proofholds/[id]/dispute/file">) => {
    const { id } = await ctx.params;
    const updated = await fileEvidence(await db(), await sellerProofhold(id));
    return json({ proofhold: sellerView(updated) });
  },
);
