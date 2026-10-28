import { HttpError, handle } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { getEvidenceBytes, getProofhold } from "@/lib/store/repos";
import { currentWorkspace } from "@/lib/session/workspace";

/** Evidence bytes, for the owning seller or anyone holding the buyer link. */
export const GET = handle(
  async (request: Request, ctx: RouteContext<"/api/evidence/[id]">) => {
    const { id } = await ctx.params;
    const sql = await db();
    const stored = await getEvidenceBytes(sql, id);
    if (!stored || !stored.bytes) throw new HttpError("Not found.", 404);
    const ph = await getProofhold(sql, stored.item.proofholdId);
    if (!ph) throw new HttpError("Not found.", 404);
    const token = new URL(request.url).searchParams.get("t");
    const ws = await currentWorkspace();
    const allowed =
      (ws && ws.id === ph.workspaceId) || (token && token === ph.buyerToken);
    if (!allowed) throw new HttpError("Not found.", 404);
    const mime = stored.item.mime ?? "application/octet-stream";
    const inline = /^(image\/|application\/pdf|text\/plain)/.test(mime);
    return new Response(stored.bytes as BodyInit, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(stored.bytes.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(stored.item.name)}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
);
