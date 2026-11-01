import { config } from "@/lib/config";
import { db } from "@/lib/store/sql";
import { tick } from "@/lib/scheduler/tick";

/** Runs one scheduler pass. Protected by TICK_SECRET when set. */
async function run(request: Request) {
  const secret = config().TICK_SECRET;
  const provided =
    request.headers.get("x-tick-secret") ??
    new URL(request.url).searchParams.get("secret");
  // Without a secret the endpoint does not exist: the inline scheduler needs no
  // caller, and an external one must identify itself.
  if (!secret) return new Response(null, { status: 404 });
  if (provided !== secret) return Response.json({ error: "Forbidden" }, { status: 403 });
  const report = await tick(await db());
  return Response.json(report);
}

export const GET = run;
export const POST = run;
