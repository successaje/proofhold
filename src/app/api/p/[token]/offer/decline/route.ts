import { z } from "zod";
import { buyerProofhold, handle, json, readJson } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { declineOffer } from "@/lib/proofholds/buyer";
import { proofholdView } from "@/lib/view";

const schema = z.object({ reason: z.string().max(1000).optional().nullable() });

export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/p/[token]/offer/decline">) => {
    const { token } = await ctx.params;
    const input = schema.parse(await readJson(request).catch(() => ({})));
    const updated = await declineOffer(
      await db(),
      await buyerProofhold(token),
      input.reason ?? null,
    );
    return json({ proofhold: proofholdView(updated) });
  },
);
