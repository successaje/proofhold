import { handle, json, sellerProofhold } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { removeFile } from "@/lib/proofholds/evidence";

export const DELETE = handle(
  async (
    _req: Request,
    ctx: RouteContext<"/api/proofholds/[id]/evidence/[evidenceId]">,
  ) => {
    const { id, evidenceId } = await ctx.params;
    const ph = await sellerProofhold(id);
    await removeFile(await db(), ph, evidenceId);
    return json({ ok: true });
  },
);
