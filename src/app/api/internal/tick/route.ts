import { config } from "@/lib/config";
import { db } from "@/lib/store/sql";
import { tick } from "@/lib/scheduler/tick";

/** Runs one scheduler pass. Protected by TICK_SECRET when set. */
async function run(request: Request) {
  const secret = config().TICK_SECRET;
  const provided =
    request.headers.get("x-tick-secret") ??
    new URL(request.url).searchParams.get("secret");
  if (secret && provided !== secret)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (
    !secret &&
    config().NODE_ENV === "production" &&
    config().PROOFHOLD_SCHEDULER === "external"
  )
    return Response.json(
      { error: "Set TICK_SECRET to expose this endpoint." },
      { status: 403 },
    );
  const report = await tick(await db());
  return Response.json(report);
}

export const GET = run;
export const POST = run;
