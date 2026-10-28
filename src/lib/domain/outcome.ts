/**
 * One-line outcome summaries for closed proofholds, and the time it took to
 * get there. Pure so the list page and the eval tooling share the words.
 */
import { formatAmount, type Proofhold } from "./proofhold";

const closed = new Set<Proofhold["status"]>([
  "released",
  "partially_released",
  "voided",
  "refunded",
  "expired",
  "cancelled",
]);

export function isClosed(status: Proofhold["status"]): boolean {
  return closed.has(status);
}

/** Milliseconds from evidence submission to the recorded decision, when both exist. */
export function timeToDecision(ph: Pick<Proofhold, "evidenceSubmittedAt" | "decidedAt">) {
  if (!ph.evidenceSubmittedAt || !ph.decidedAt) return null;
  const ms = Date.parse(ph.decidedAt) - Date.parse(ph.evidenceSubmittedAt);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

export function formatDuration(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 1) return "under a minute";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/** What happened, in the seller's words, for a closed proofhold. */
export function outcomeLine(
  ph: Pick<
    Proofhold,
    | "status"
    | "amountCents"
    | "releasedCents"
    | "currency"
    | "evidenceSubmittedAt"
    | "decidedAt"
  >,
): string | null {
  const took = timeToDecision(ph);
  const after = took === null ? "" : ` · ${formatDuration(took)} from submission`;
  switch (ph.status) {
    case "released":
      return `Released ${formatAmount(ph.releasedCents, ph.currency)}${after}`;
    case "partially_released":
      return `Released ${formatAmount(ph.releasedCents, ph.currency)} · returned ${formatAmount(ph.amountCents - ph.releasedCents, ph.currency)}${after}`;
    case "voided":
      return `Hold returned to the buyer${after}`;
    case "refunded":
      return "PayPal decided for the buyer and refunded the capture";
    case "expired":
      return "Hold expired before a decision";
    case "cancelled":
      return "Cancelled before any money was held";
    default:
      return null;
  }
}

/** Median time from submission to decision across the given proofholds, or null. */
export function medianTimeToDecision(
  items: Pick<Proofhold, "status" | "evidenceSubmittedAt" | "decidedAt">[],
): number | null {
  const times = items
    .filter((p) => p.status === "released" || p.status === "partially_released")
    .map(timeToDecision)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  if (times.length === 0) return null;
  const mid = Math.floor(times.length / 2);
  return times.length % 2 ? times[mid]! : (times[mid - 1]! + times[mid]!) / 2;
}
