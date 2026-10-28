import { buyerProofhold, handle } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { evidenceBundle } from "@/lib/proofholds/bundle";

/** The same evidence record the seller can download, available to whoever holds the buyer link. */
export const GET = handle(
  async (_req: Request, ctx: RouteContext<"/api/p/[token]/bundle">) => {
    const { token } = await ctx.params;
    const ph = await buyerProofhold(token);
    const bundle = await evidenceBundle(await db(), ph);
    return new Response(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="proofhold-${ph.id}-record.json"`,
      },
    });
  },
);
