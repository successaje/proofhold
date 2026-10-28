import { z } from "zod";
import { handle, json, readJson, HttpError } from "@/lib/http";
import { currentWorkspace } from "@/lib/session/workspace";
import { compileBrief } from "@/lib/compiler/compile";
import { kinds } from "@/lib/domain/proofhold";

const schema = z.object({
  brief: z.string().trim().min(10).max(6000),
  kind: z.enum(kinds),
  amountCents: z.number().int().min(100).max(1_000_000),
  currency: z.string().default("USD"),
  deadline: z.string().optional().nullable(),
});

export const POST = handle(async (request: Request) => {
  if (!(await currentWorkspace())) throw new HttpError("Sign in first.", 401);
  const input = schema.parse(await readJson(request));
  const result = await compileBrief(input);
  return json(result);
});
