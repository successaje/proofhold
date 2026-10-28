import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status";
import { PageHeader } from "@/components/shell/page-header";
import { currentWorkspace } from "@/lib/session/workspace";
import { db } from "@/lib/store/sql";
import { listProofholds } from "@/lib/store/repos";
import { statusMeta, type Proofhold } from "@/lib/domain/proofhold";
import { formatDate, formatMoney, durationLeft } from "@/lib/format";
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
      return "Deliver and submit evidence";
    case "checking":
      return "Checks running";
    case "awaiting_buyer":
      return ph.silenceWindowEndsAt
        ? `Buyer window closes in ${durationLeft(ph.silenceWindowEndsAt)}`
        : "Waiting for the buyer";
    case "in_review":
      return ph.offerCents
        ? "Offer sent; waiting for the buyer"
        : "Buyer objected; propose a partial release";
    case "disputed":
      return "PayPal dispute open";
    default:
      return statusMeta[ph.status].summary;
  }
}

function Row({ ph }: { ph: Proofhold }) {
  const meta = statusMeta[ph.status];
  return (
    <li>
      <Link href={`/app/h/${ph.id}`} className={styles.row}>
        <div className={styles.rowMain}>
          <span className={styles.rowTitle}>{ph.title}</span>
          <span className={styles.rowSub}>
            {ph.buyerName ?? ph.buyerEmail ?? "No buyer yet"} ·{" "}
            {ph.kind === "goods" ? "Goods" : "Service"} · {formatDate(ph.updatedAt)}
          </span>
        </div>
        <span className={styles.rowNext}>{nextStep(ph)}</span>
        <span className={styles.rowAmount}>
          {formatMoney(ph.amountCents, ph.currency)}
        </span>
        <StatusPill tone={meta.tone} pulse={ph.status === "checking"}>
          {meta.label}
        </StatusPill>
        <ArrowRight className={styles.rowArrow} aria-hidden="true" />
      </Link>
    </li>
  );
}

function Group({ title, items }: { title: string; items: Proofhold[] }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.group}>
      <h2 className={styles.groupTitle}>
        {title} <span>{items.length}</span>
      </h2>
      <ul className={styles.list}>
        {items.map((ph) => (
          <Row key={ph.id} ph={ph} />
        ))}
      </ul>
    </section>
  );
}

export default async function ProofholdsPage() {
  const ws = (await currentWorkspace())!;
  const all = await listProofholds(await db(), ws.id);
  const needs = all.filter((p) => attention.includes(p.status));
  const open = all.filter((p) => active.includes(p.status));
  const closed = all.filter(
    (p) => !attention.includes(p.status) && !active.includes(p.status),
  );
  const held = all
    .filter((p) => ["held", "checking", "awaiting_buyer", "in_review"].includes(p.status))
    .reduce((s, p) => s + p.amountCents - p.releasedCents, 0);
  const released = all.reduce((s, p) => s + p.releasedCents, 0);

  return (
    <>
      <PageHeader
        title="Proofholds"
        lead={
          all.length > 0
            ? `${formatMoney(held, "USD")} held by PayPal across ${open.length + needs.length} active · ${formatMoney(released, "USD")} released to you`
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
          <Group title="Needs attention" items={needs} />
          <Group title="Active" items={open} />
          <Group title="Closed" items={closed} />
        </>
      )}
    </>
  );
}
