/**
 * Starts the inline scheduler once per server process (Node runtime only).
 * Set PROOFHOLD_SCHEDULER=external to drive /api/internal/tick from cron instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { config } = await import("./lib/config");
  if (config().PROOFHOLD_SCHEDULER !== "inline") return;
  const { db } = await import("./lib/store/sql");
  const { tick } = await import("./lib/scheduler/tick");
  const intervalMs = Number(process.env.PROOFHOLD_TICK_SECONDS ?? 30) * 1000;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const report = await tick(await db());
      if (report.errors.length > 0) console.warn("[scheduler] errors", report.errors);
    } catch (error) {
      console.error("[scheduler] tick failed", error);
    } finally {
      running = false;
    }
  };
  setTimeout(run, 5_000);
  const timer = setInterval(run, intervalMs);
  timer.unref();
}
