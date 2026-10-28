import { buyerProofhold, handle, json } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { listChecks, listDecisions, listEvidence, listMessages } from "@/lib/store/repos";
import { proofholdView, systemInfo } from "@/lib/view";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/p/[token]">) => {
  const { token } = await ctx.params;
  const ph = await buyerProofhold(token);
  const sql = await db();
  const [evidence, checks, decisions, messages] = await Promise.all([
    listEvidence(sql, ph.id),
    listChecks(sql, ph.id),
    listDecisions(sql, ph.id),
    listMessages(sql, ph.id),
  ]);
  return json({
    proofhold: proofholdView(ph),
    evidence,
    checks,
    decisions,
    messages,
    system: systemInfo(),
  });
});
