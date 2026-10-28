import { z } from "zod";
import { handle, json, readJson, sellerProofhold } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { endHold } from "@/lib/proofholds/buyer";
import { sellerView } from "@/lib/view";

const schema = z.object({ reason: z.string().trim().min(3).max(500) });

export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/proofholds/[id]/end">) => {
    const { id } = await ctx.params;
    const ph = await sellerProofhold(id);
    const input = schema.parse(await readJson(request));
    const updated = await endHold(await db(), ph, "seller", input.reason);
    return json({ proofhold: sellerView(updated) });
  },
);
