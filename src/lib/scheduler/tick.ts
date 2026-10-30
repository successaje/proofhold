/**
 * Background work, in one idempotent pass:
 * 1. finish examinations left in `checking`,
 * 2. close buyer windows that ended,
 * 3. reauthorize holds whose honor period passed (once),
 * 4. expire holds past their authorization, and
 * 5. reconcile active holds with PayPal.
 */
import { HONOR_PERIOD_DAYS } from "../paypal/client";
import { paypal } from "../paypal";
import { isHoldActive, type Proofhold } from "../domain/proofhold";
import { listProofholdsByStatus, updateProofhold } from "../store/repos";
import type { Sql } from "../store/sql";
import { evaluate, runExaminer } from "../proofholds/evidence";
import { note } from "../proofholds/lifecycle";
import { reconcile } from "../proofholds/reconcile";
import { expire } from "../proofholds/release";
import { appendAudit, listAudit } from "../store/repos";
import { syncDispute } from "../proofholds/disputes";

export interface TickReport {
  at: string;
  examined: string[];
  windowsClosed: string[];
  reauthorized: string[];
  expired: string[];
  reconciled: string[];
  disputesSynced: string[];
  errors: { id: string; step: string; message: string }[];
}

const RECONCILE_EVERY_MS = 10 * 60_000;

export async function tick(sql: Sql, now = new Date()): Promise<TickReport> {
  const report: TickReport = {
    at: now.toISOString(),
    examined: [],
    windowsClosed: [],
    reauthorized: [],
    expired: [],
    reconciled: [],
    disputesSynced: [],
    errors: [],
  };
  const active = await listProofholdsByStatus(sql, [
    "checking",
    "held",
    "awaiting_buyer",
    "in_review",
    "disputed",
    "proposed",
  ]);
  const guard = async (ph: Proofhold, step: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      report.errors.push({
        id: ph.id,
        step,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  for (const ph of active) {
    if (ph.status === "checking") {
      await guard(ph, "examine", async () => {
        await runExaminer(sql, ph);
        report.examined.push(ph.id);
      });
      continue;
    }
    if (ph.status === "disputed") {
      await guard(ph, "dispute", async () => {
        await syncDispute(sql, ph);
        report.disputesSynced.push(ph.id);
      });
      continue;
    }
    if (ph.status === "proposed") continue;

    // Expiry: the authorization lapsed.
    if (
      ph.authorizationExpiresAt &&
      Date.parse(ph.authorizationExpiresAt) <= now.getTime()
    ) {
      await guard(ph, "expire", async () => {
        await expire(sql, ph, "The PayPal authorization expired before a decision.");
        report.expired.push(ph.id);
      });
      continue;
    }

    // Buyer window closed.
    if (
      ph.status === "awaiting_buyer" &&
      ph.silenceWindowEndsAt &&
      Date.parse(ph.silenceWindowEndsAt) <= now.getTime()
    ) {
      let moved = false;
      await guard(ph, "window", async () => {
        const after = await evaluate(sql, ph, now);
        if (after.status !== ph.status) {
          report.windowsClosed.push(ph.id);
          moved = true;
        } else {
          // Blocked: the window closing changes nothing, so say so once.
          const entries = await listAudit(sql, ph.id);
          const since = ph.evidenceSubmittedAt ? Date.parse(ph.evidenceSubmittedAt) : 0;
          const named = entries.some(
            (e) => e.type === "window_closed" && Date.parse(e.createdAt) >= since,
          );
          if (!named)
            await appendAudit(sql, ph.id, "window_closed", {
              reason:
                "The buyer window closed with release still blocked. Nothing moves until the buyer confirms or objects, or the seller resubmits.",
            });
        }
      });
      if (moved) continue;
    }

    // Reauthorize once after the honor period so a later capture is guaranteed.
    const honorEnded =
      ph.honorPeriodEndsAt && Date.parse(ph.honorPeriodEndsAt) <= now.getTime();
    const expiresSoon =
      ph.authorizationExpiresAt &&
      Date.parse(ph.authorizationExpiresAt) - now.getTime() < 86_400_000;
    if (
      honorEnded &&
      !ph.reauthorizedAt &&
      !expiresSoon &&
      ph.paypalAuthorizationId &&
      isHoldActive(ph.status)
    ) {
      await guard(ph, "reauthorize", async () => {
        const pp = await paypal();
        const next = await pp.reauthorize(ph.paypalAuthorizationId!, {
          amountCents: ph.amountCents,
          currency: ph.currency,
        });
        await note(
          sql,
          ph,
          "reauthorized",
          {
            from: ph.paypalAuthorizationId,
            to: next.authorizationId,
            expiresAt: next.expiresAt,
          },
          {
            paypalAuthorizationId: next.authorizationId,
            authorizationExpiresAt: next.expiresAt,
            reauthorizedAt: now.toISOString(),
          },
        );
        report.reauthorized.push(ph.id);
      });
      continue;
    }

    // Reconcile with PayPal on an interval.
    const stale =
      !ph.lastReconciledAt ||
      now.getTime() - Date.parse(ph.lastReconciledAt) > RECONCILE_EVERY_MS;
    if (stale && ph.paypalAuthorizationId) {
      await guard(ph, "reconcile", async () => {
        await reconcile(sql, ph);
        report.reconciled.push(ph.id);
      });
    }
  }
  return report;
}

export { HONOR_PERIOD_DAYS, updateProofhold };
