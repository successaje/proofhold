import { handle, json, readJson, sellerProofhold } from "@/lib/http";
import { db } from "@/lib/store/sql";
import {
  listAudit,
  listChecks,
  listDecisions,
  listEvidence,
  listMessages,
} from "@/lib/store/repos";
import { updateDraft } from "@/lib/proofholds/compose";
import { sellerView, systemInfo } from "@/lib/view";

export const GET = handle(
  async (_req: Request, ctx: RouteContext<"/api/proofholds/[id]">) => {
    const { id } = await ctx.params;
    const ph = await sellerProofhold(id);
    const sql = await db();
    const [evidence, checks, decisions, messages, audit] = await Promise.all([
      listEvidence(sql, ph.id),
      listChecks(sql, ph.id),
      listDecisions(sql, ph.id),
      listMessages(sql, ph.id),
      listAudit(sql, ph.id),
    ]);
    return json({
      proofhold: sellerView(ph),
      evidence,
      checks,
      decisions,
      messages,
      audit,
      system: systemInfo(),
    });
  },
);

export const PATCH = handle(
  async (request: Request, ctx: RouteContext<"/api/proofholds/[id]">) => {
    const { id } = await ctx.params;
    const ph = await sellerProofhold(id);
    const updated = await updateDraft(await db(), ph, await readJson(request));
    return json({ proofhold: sellerView(updated) });
  },
);
