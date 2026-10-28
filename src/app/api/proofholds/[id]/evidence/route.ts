import { handle, json, sellerProofhold, HttpError } from "@/lib/http";
import { db } from "@/lib/store/sql";
import { addFile } from "@/lib/proofholds/evidence";

export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/proofholds/[id]/evidence">) => {
    const { id } = await ctx.params;
    const ph = await sellerProofhold(id);
    const form = await request.formData().catch(() => null);
    if (!form) throw new HttpError("Expected a multipart upload.", 400);
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new HttpError("Choose at least one file.", 400);
    const sql = await db();
    const items = [];
    for (const file of files) {
      items.push(
        await addFile(sql, ph, {
          name: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
          declaredMime: file.type || null,
        }),
      );
    }
    return json({ evidence: items }, { status: 201 });
  },
);
