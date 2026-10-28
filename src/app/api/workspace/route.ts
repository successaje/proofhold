import { z } from "zod";
import { handle, json, readJson, HttpError } from "@/lib/http";
import {
  currentWorkspace,
  endWorkspaceSession,
  startWorkspace,
} from "@/lib/session/workspace";
import { db } from "@/lib/store/sql";
import { updateWorkspace } from "@/lib/store/repos";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
});

export const GET = handle(async () => {
  const ws = await currentWorkspace();
  return json({ workspace: ws });
});

export const POST = handle(async (request: Request) => {
  const input = schema.parse(await readJson(request));
  const ws = await startWorkspace(input);
  return json({ workspace: ws }, { status: 201 });
});

export const PATCH = handle(async (request: Request) => {
  const ws = await currentWorkspace();
  if (!ws) throw new HttpError("Sign in first.", 401);
  const input = schema.parse(await readJson(request));
  await updateWorkspace(await db(), ws.id, input);
  return json({ workspace: { ...ws, ...input } });
});

export const DELETE = handle(async () => {
  await endWorkspaceSession();
  return json({ ok: true });
});
