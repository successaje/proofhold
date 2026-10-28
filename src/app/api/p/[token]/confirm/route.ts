import { z } from "zod";
import { buyerProofhold, handle, json, readJson } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { confirm } from "@/lib/proofholds/buyer";
import { proofholdView } from "@/lib/view";

const schema = z.object({ message: z.string().max(1000).optional().nullable() });

export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/p/[token]/confirm">) => {
    const { token } = await ctx.params;
    const ph = await buyerProofhold(token);
    const input = schema.parse(await readJson(request).catch(() => ({})));
    const updated = await confirm(await db(), ph, input.message ?? null);
    return json({ proofhold: proofholdView(updated) });
  },
);
