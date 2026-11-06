import { readFileSync } from "node:fs";
import { config } from "@/lib/config";
import { db } from "@/lib/store/sql";
import { getMeta } from "@/lib/store/repos";
import { systemInfo } from "@/lib/view";

const version = (() => {
  try {
    return JSON.parse(readFileSync("package.json", "utf8")).version as string;
  } catch {
    return "unknown";
  }
})();
const startedAt = Date.now();

/**
 * Liveness and readiness in one: the database answers, the modes in force, and
 * whether the inline scheduler has run recently. 503 when something is wrong.
 */
export async function GET() {
  const c = config();
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  try {
    const t = Date.now();
    await (await db()).get("SELECT 1 AS ok");
    checks.database = { ok: true, detail: `${c.PROOFHOLD_STORE} · ${Date.now() - t} ms` };
  } catch (error) {
    checks.database = {
      ok: false,
      detail: error instanceof Error ? error.message : "failed",
    };
  }
  let tick: { at: string; errors: number } | null = null;
  try {
    tick = await getMeta<{ at: string; errors: number }>(
      await db(),
      "scheduler.last_tick",
    );
  } catch {
    tick = null;
  }
  if (c.PROOFHOLD_SCHEDULER === "inline") {
    const age = tick ? Date.now() - Date.parse(tick.at) : null;
    // The first pass runs 30 s after boot; allow five minutes before calling it stale.
    const stale = age === null ? Date.now() - startedAt > 5 * 60_000 : age > 5 * 60_000;
    checks.scheduler = {
      ok: !stale,
      detail: tick ? `last pass ${tick.at}, ${tick.errors} errors` : "no pass yet",
    };
  } else {
    checks.scheduler = { ok: true, detail: c.PROOFHOLD_SCHEDULER };
  }
  const ok = Object.values(checks).every((x) => x.ok);
  const info = systemInfo();
  return Response.json(
    {
      ok,
      version,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      paypalMode: info.paypalMode,
      examiner: info.examinerMode,
      mail: info.mailMode,
      checks,
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
