import { z } from "zod";
import { buyerProofhold, handle, json, readJson } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { object } from "@/lib/proofholds/buyer";
import { proofholdView } from "@/lib/view";

const schema = z.object({ reason: z.string().trim().min(5).max(1000) });

export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/p/[token]/object">) => {
    const { token } = await ctx.params;
    const ph = await buyerProofhold(token);
    const input = schema.parse(await readJson(request));
    const updated = await object(await db(), ph, input.reason);
    return json({ proofhold: proofholdView(updated) });
  },
);
