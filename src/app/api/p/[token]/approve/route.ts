import { z } from "zod";
import { buyerProofhold, handle, json, readJson } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { startApproval } from "@/lib/proofholds/approval";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
});

export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/p/[token]/approve">) => {
    const { token } = await ctx.params;
    const ph = await buyerProofhold(token);
    const input = schema.parse(await readJson(request));
    const result = await startApproval(await db(), ph, input);
    return json(result);
  },
);
