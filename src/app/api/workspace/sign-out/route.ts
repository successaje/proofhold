import { handle, json } from "@/lib/http";
import { endWorkspaceSession } from "@/lib/session/workspace";

/** Forget this browser. The workspace and its data stay. */
export const POST = handle(async () => {
  await endWorkspaceSession();
  return json({ ok: true });
});
