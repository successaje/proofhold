/**
 * The seller's ledger: filtering, sorting and a CSV export of proofholds.
 * Pure so the list page and the export route agree.
 */
import { statusMeta, type Proofhold } from "./proofhold";
import { isClosed, outcomeLine, timeToDecision } from "./outcome";

export type LedgerBucket = "all" | "attention" | "active" | "closed";
export type LedgerSort = "updated" | "amount" | "title" | "created";

export interface LedgerQuery {
  q?: string;
  bucket?: LedgerBucket;
  sort?: LedgerSort;
}

const attention = new Set<Proofhold["status"]>([
  "checking",
  "awaiting_buyer",
  "in_review",
  "disputed",
]);
const active = new Set<Proofhold["status"]>(["draft", "proposed", "held"]);

export function bucketOf(status: Proofhold["status"]): Exclude<LedgerBucket, "all"> {
  if (attention.has(status)) return "attention";
  if (active.has(status)) return "active";
  return "closed";
}

export function parseLedgerQuery(
  params: Record<string, string | undefined>,
): LedgerQuery {
  const bucket = params.bucket;
  const sort = params.sort;
  return {
    q: (params.q ?? "").trim().slice(0, 120) || undefined,
    bucket:
      bucket === "attention" || bucket === "active" || bucket === "closed"
        ? bucket
        : "all",
    sort: sort === "amount" || sort === "title" || sort === "created" ? sort : "updated",
  };
}

export function filterLedger(items: Proofhold[], query: LedgerQuery): Proofhold[] {
  const q = query.q?.toLowerCase();
  let out = items.filter((p) => {
    if (query.bucket && query.bucket !== "all" && bucketOf(p.status) !== query.bucket)
      return false;
    if (!q) return true;
    const hay = [
      p.title,
      p.brief,
      p.buyerName ?? "",
      p.buyerEmail ?? "",
      p.payerEmail ?? "",
      p.id,
      statusMeta[p.status].label,
      p.paypalOrderId ?? "",
      p.paypalAuthorizationId ?? "",
    ]
      .join("\n")
      .toLowerCase();
    return hay.includes(q);
  });
  const sort = query.sort ?? "updated";
  out = [...out].sort((a, b) => {
    switch (sort) {
      case "amount":
        return b.amountCents - a.amountCents || b.updatedAt.localeCompare(a.updatedAt);
      case "title":
        return a.title.localeCompare(b.title) || b.updatedAt.localeCompare(a.updatedAt);
      case "created":
        return b.createdAt.localeCompare(a.createdAt);
      default:
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  });
  return out;
}

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per proofhold, amounts as decimals, times as ISO 8601 UTC. */
export function ledgerCsv(items: Proofhold[]): string {
  const header = [
    "id",
    "title",
    "kind",
    "status",
    "amount",
    "released",
    "returned",
    "currency",
    "buyer_name",
    "buyer_email",
    "paypal_order",
    "paypal_authorization",
    "created_at",
    "buyer_agreed_at",
    "evidence_submitted_at",
    "decided_at",
    "minutes_to_decision",
    "outcome",
  ];
  const rows = items.map((p) => {
    const took = timeToDecision(p);
    return [
      p.id,
      p.title,
      p.kind,
      p.status,
      (p.amountCents / 100).toFixed(2),
      (p.releasedCents / 100).toFixed(2),
      isClosed(p.status) ? ((p.amountCents - p.releasedCents) / 100).toFixed(2) : "",
      p.currency,
      p.buyerName,
      p.buyerEmail ?? p.payerEmail,
      p.paypalOrderId,
      p.paypalAuthorizationId,
      p.createdAt,
      p.buyerAgreedAt,
      p.evidenceSubmittedAt,
      p.decidedAt,
      took === null ? "" : Math.round(took / 60_000),
      outcomeLine(p) ?? statusMeta[p.status].summary,
    ]
      .map(csvCell)
      .join(",");
  });
  return [header.join(","), ...rows].join("\r\n") + "\r\n";
}
