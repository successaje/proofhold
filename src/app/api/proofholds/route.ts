import { handle, json, readJson, HttpError } from "@/lib/http";
import { currentWorkspace } from "@/lib/session/workspace";
import { db } from "@/lib/store/sql";
import { listProofholds } from "@/lib/store/repos";
import { createDraft } from "@/lib/proofholds/compose";
import { sellerView } from "@/lib/view";

export const GET = handle(async () => {
  const ws = await currentWorkspace();
  if (!ws) throw new HttpError("Sign in first.", 401);
  const items = await listProofholds(await db(), ws.id);
  return json({ proofholds: items.map(sellerView) });
});

export const POST = handle(async (request: Request) => {
  const ws = await currentWorkspace();
  if (!ws) throw new HttpError("Sign in first.", 401);
  const ph = await createDraft(await db(), ws.id, await readJson(request));
  return json({ proofhold: sellerView(ph) }, { status: 201 });
});
