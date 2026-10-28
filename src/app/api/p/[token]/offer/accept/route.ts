import { buyerProofhold, handle, json } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { acceptOffer } from "@/lib/proofholds/buyer";
import { proofholdView } from "@/lib/view";

export const POST = handle(
  async (_req: Request, ctx: RouteContext<"/api/p/[token]/offer/accept">) => {
    const { token } = await ctx.params;
    const updated = await acceptOffer(await db(), await buyerProofhold(token));
    return json({ proofhold: proofholdView(updated) });
  },
);
