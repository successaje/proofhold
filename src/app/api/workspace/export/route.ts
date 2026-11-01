import { handle, HttpError } from "@/lib/http";
import { currentWorkspace } from "@/lib/session/workspace";
import { db } from "@/lib/store/sql";
import { exportWorkspace } from "@/lib/store/repos";

/** Everything the workspace owns, as one JSON file. File bytes are not included; the evidence routes serve those. */
export const GET = handle(async () => {
  const ws = await currentWorkspace();
  if (!ws) throw new HttpError("Sign in first.", 401);
  const data = await exportWorkspace(await db(), ws.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="proofhold-workspace-${ws.id}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
