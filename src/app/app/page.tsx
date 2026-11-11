import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PanelRightOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status";
import { PageHeader } from "@/components/shell/page-header";
import { MiniSeal, segmentsFor, stampFor } from "@/components/proofhold/seal";
import { currentWorkspace } from "@/lib/session/workspace";
import { db } from "@/lib/store/sql";
import { listChecks, listChecksFor, listProofholds } from "@/lib/store/repos";
import { statusMeta, type Proofhold } from "@/lib/domain/proofhold";
import {
  formatDuration,
  isClosed,
  medianTimeToDecision,
  outcomeLine,
} from "@/lib/domain/outcome";
import { formatMoney, durationLeft, relativeTime, shortId } from "@/lib/format";
import { systemInfo } from "@/lib/view";
import type { CheckResult } from "@/lib/domain/proofhold";
import {
  bucketOf,
  filterLedger,
  parseLedgerQuery,
  type LedgerBucket,
} from "@/lib/domain/ledger";
import { LedgerControls } from "./ledger-controls";
import { Inspector } from "./inspector";
import styles from "./list.module.css";

export const metadata: Metadata = { title: "Proofholds" };

const attention: Proofhold["status"][] = [
  "checking",
  "awaiting_buyer",
  "in_review",
  "disputed",
];
const active: Proofhold["status"][] = ["draft", "proposed", "held"];

function nextStep(ph: Proofhold): string {
  switch (ph.status) {
    case "draft":
      return "Finish and send";
    case "proposed":
      return "Waiting for the buyer to approve";
    case "held":
      return ph.authorizationExpiresAt
        ? `Deliver and submit evidence · hold valid ${durationLeft(ph.authorizationExpiresAt)}`
        : "Deliver and submit evidence";
    case "checking":
      return "Checks running";
    case "awaiting_buyer": {
      const blocked =
        (ph.decision as { outcome?: { kind?: string } } | null)?.outcome?.kind ===
        "blocked";
      if (blocked) return "Waiting for the buyer's decision · no automatic release";
      return ph.silenceWindowEndsAt
        ? `Releases in ${durationLeft(ph.silenceWindowEndsAt)} unless the buyer objects`
        : "Waiting for the buyer";
    }
    case "in_review":
      return ph.offerCents
        ? "Offer sent; waiting for the buyer"
        : "Buyer objected; propose a partial release";
    case "disputed":
      return "PayPal dispute open";
    default:
      return outcomeLine(ph) ?? statusMeta[ph.status].summary;
  }
}

function Row({
  ph,
  n,
  peekHref,
  peeked,
  checks,
}: {
  ph: Proofhold;
  n: number;
  peekHref: string;
  peeked: boolean;
  checks: CheckResult[];
}) {
  const meta = statusMeta[ph.status];
  const notYet = ph.status === "draft" || ph.status === "proposed";
  return (
    <li className={peeked ? styles.rowPeeked : undefined}>
      <Link href={`/app/h/${ph.id}`} className={styles.row}>
        <span className={styles.rowNo} aria-hidden="true">
          {String(n).padStart(2, "0")}
        </span>
        <MiniSeal
          title={meta.label}
          segments={
            notYet
              ? ph.test.predicates.map(() => "pending" as const)
              : segmentsFor(ph.test, checks)
          }
          stamp={stampFor(ph.status)}
          pending={notYet}
          size={30}
        />
        <div className={styles.rowMain}>
          <span className={styles.rowTitle}>{ph.title}</span>
          <span className={styles.rowSub}>
            <span className={styles.rowId}>{shortId(ph.id)}</span>
            {ph.buyerName ?? ph.buyerEmail ?? "No buyer yet"} ·{" "}
            {ph.kind === "goods" ? "Goods" : "Service"}
          </span>
        </div>
        <span className={styles.rowNext}>{nextStep(ph)}</span>
        <span className={styles.rowWhen}>{relativeTime(ph.updatedAt)}</span>
        <span className={styles.rowAmount}>
          {formatMoney(ph.amountCents, ph.currency)}
        </span>
        <span className={styles.rowStatus}>
          <StatusPill tone={meta.tone} pulse={ph.status === "checking"}>
            {meta.label}
          </StatusPill>
        </span>
        <ArrowRight className={styles.rowArrow} aria-hidden="true" />
      </Link>
      <Link
        href={peekHref}
        className={styles.peek}
        aria-label={`Inspect ${ph.title}`}
        aria-current={peeked ? "true" : undefined}
        aria-controls={peeked ? "inspector" : undefined}
        title="Inspect"
        scroll={false}
      >
        <PanelRightOpen aria-hidden="true" />
      </Link>
    </li>
  );
}

function Group({
  title,
  items,
  start,
  peekFor,
  peeked,
  checks,
}: {
  title: string;
  items: Proofhold[];
  start: number;
  peekFor: (id: string) => string;
  peeked: string | null;
  checks: Map<string, CheckResult[]>;
}) {
  if (items.length === 0) return null;
  return (
    <section className={styles.group}>
      <h2 className={styles.groupTitle}>
        {title} <span>{items.length}</span>
      </h2>
      <ul className={styles.list}>
        {items.map((ph, i) => (
          <Row
            key={ph.id}
            ph={ph}
            n={start + i + 1}
            peekHref={peekFor(ph.id)}
            peeked={peeked === ph.id}
            checks={checks.get(ph.id) ?? []}
          />
        ))}
      </ul>
    </section>
  );
}

export default async function ProofholdsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ws = (await currentWorkspace())!;
  const sql = await db();
  const all = await listProofholds(sql, ws.id);
  const sp = await searchParams;
  const query = parseLedgerQuery(sp);
  const peeked = all.find((p) => p.id === sp.peek) ?? null;
  const [peekedChecks, checksById] = await Promise.all([
    peeked ? listChecks(sql, peeked.id) : Promise.resolve([] as CheckResult[]),
    listChecksFor(
      sql,
      all.filter((p) => p.status !== "draft" && p.status !== "proposed").map((p) => p.id),
    ),
  ]);
  const demoWindows = systemInfo().demoSilenceMinutes !== null;
  const base = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && k !== "peek") base.set(k, v);
  const hrefWith = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(base);
    for (const [k, v] of Object.entries(patch)) if (v) q.set(k, v);
    const qs = q.toString();
    return qs ? `/app?${qs}` : "/app";
  };
  const peekFor = (id: string) => hrefWith({ peek: peeked?.id === id ? null : id });
  const shown = filterLedger(all, query);
  const counts: Record<LedgerBucket, number> = {
    all: all.length,
    attention: all.filter((p) => bucketOf(p.status) === "attention").length,
    active: all.filter((p) => bucketOf(p.status) === "active").length,
    closed: all.filter((p) => bucketOf(p.status) === "closed").length,
  };
  const filtering = Boolean(query.q) || query.bucket !== "all";
  const needs = shown.filter((p) => attention.includes(p.status));
  const open = shown.filter((p) => active.includes(p.status));
  const closed = shown.filter((p) => isClosed(p.status));
  const heldItems = all.filter((p) =>
    ["held", "checking", "awaiting_buyer", "in_review", "disputed"].includes(p.status),
  );
  const held = heldItems.reduce((s, p) => s + p.amountCents - p.releasedCents, 0);
  const awaiting = all.filter((p) => p.status === "proposed").length;
  const released = all.reduce((s, p) => s + p.releasedCents, 0);
  const median = medianTimeToDecision(all);

  return (
    <>
      <PageHeader
        title="Proofholds"
        lead={
          all.length > 0
            ? [
                heldItems.length > 0
                  ? `${formatMoney(held, "USD")} held by PayPal across ${heldItems.length} hold${heldItems.length === 1 ? "" : "s"}`
                  : "Nothing held by PayPal right now",
                awaiting > 0 ? `${awaiting} awaiting the buyer's approval` : null,
                `${formatMoney(released, "USD")} released to you`,
                median !== null
                  ? `typical time from submission to release ${formatDuration(median)}${demoWindows ? " (demo windows)" : ""}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        actions={
          <Button href="/app/new" icon={<Plus />}>
            New proofhold
          </Button>
        }
      />
      {all.length === 0 ? (
        <EmptyState
          title="Your first proofhold starts with a brief"
          action={
            <Button href="/app/new" icon={<Plus />}>
              Create a proofhold
            </Button>
          }
        >
          Paste what the job is in plain words. Proofhold turns it into an acceptance
          test, your buyer approves a PayPal hold against it, and the money releases when
          the evidence passes. Nothing here yet because you have not sent one.
        </EmptyState>
      ) : (
        <>
          <LedgerControls
            q={query.q ?? ""}
            bucket={query.bucket ?? "all"}
            sort={query.sort ?? "updated"}
            counts={counts}
          />
          <div className={peeked ? styles.ledgerWithInspector : styles.ledger}>
            {peeked ? (
              <Inspector
                ph={peeked}
                checks={peekedChecks}
                nextStep={nextStep(peeked)}
                updatedAgo={relativeTime(peeked.updatedAt)}
                closeHref={hrefWith({})}
              />
            ) : null}
            <div className={styles.ledgerMain}>
              {shown.length === 0 ? (
                <EmptyState title="Nothing matches">
                  {query.q
                    ? `No proofhold mentions “${query.q}”${query.bucket !== "all" ? " in this group" : ""}. Search covers titles, briefs, buyer names and emails, ids and PayPal references.`
                    : "Nothing in this group yet."}
                </EmptyState>
              ) : query.sort && query.sort !== "updated" ? (
                <Group
                  title={filtering ? "Results" : "All proofholds"}
                  items={shown}
                  start={0}
                  peekFor={peekFor}
                  peeked={peeked?.id ?? null}
                  checks={checksById}
                />
              ) : (
                <>
                  <Group
                    title="Needs attention"
                    items={needs}
                    start={0}
                    peekFor={peekFor}
                    peeked={peeked?.id ?? null}
                    checks={checksById}
                  />
                  <Group
                    title="Active"
                    items={open}
                    start={needs.length}
                    peekFor={peekFor}
                    peeked={peeked?.id ?? null}
                    checks={checksById}
                  />
                  <Group
                    title="Closed"
                    items={closed}
                    start={needs.length + open.length}
                    peekFor={peekFor}
                    peeked={peeked?.id ?? null}
                    checks={checksById}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
