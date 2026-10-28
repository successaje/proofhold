import { handle, sellerProofhold } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { evidenceBundle } from "@/lib/proofholds/bundle";

export const GET = handle(
  async (_req: Request, ctx: RouteContext<"/api/proofholds/[id]/bundle">) => {
    const { id } = await ctx.params;
    const ph = await sellerProofhold(id);
    const bundle = await evidenceBundle(await db(), ph);
    return new Response(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="proofhold-${ph.id}-bundle.json"`,
      },
    });
  },
);
