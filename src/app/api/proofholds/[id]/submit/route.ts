import { after } from "next/server";
import { z } from "zod";
import { handle, json, readJson, sellerProofhold } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { runExaminer, submit } from "@/lib/proofholds/evidence";
import { sellerView } from "@/lib/view";

const schema = z.object({ note: z.string().max(2000).optional().nullable() });

export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/proofholds/[id]/submit">) => {
    const { id } = await ctx.params;
    const ph = await sellerProofhold(id);
    const input = schema.parse(await readJson(request).catch(() => ({})));
    const sql = await db();
    const result = await submit(sql, ph, input.note ?? null);
    if (result.needsExaminer) {
      after(async () => {
        try {
          await runExaminer(sql, result.proofhold);
        } catch (error) {
          console.error("[examiner]", error);
        }
      });
    }
    return json({
      proofhold: sellerView(result.proofhold),
      round: result.round,
      examining: result.needsExaminer,
    });
  },
);
