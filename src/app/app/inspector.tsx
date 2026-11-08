"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mono, StatusPill } from "@/components/ui/status";
import { Rail } from "@/components/proofhold/rail";
import { Seal, holderFor, segmentsFor, stampFor } from "@/components/proofhold/seal";
import type { CheckResult, Proofhold } from "@/lib/domain/proofhold";
import { statusMeta } from "@/lib/domain/proofhold";
import { formatDate, formatMoney, shortId } from "@/lib/format";
import styles from "./list.module.css";

/**
 * The inspector: one proofhold at a glance beside the ledger, opened with
 * `?peek=<id>`. Everything here is read from the row's record; the detail
 * page remains the place to act. Focus moves to its title when it opens and
 * Escape closes it.
 */
export function Inspector({
  ph,
  checks,
  nextStep,
  updatedAgo,
  closeHref,
}: {
  ph: Proofhold;
  checks: CheckResult[];
  nextStep: string;
  /** Rendered on the server so the client never disagrees about the seconds. */
  updatedAgo: string;
  closeHref: string;
}) {
  const router = useRouter();
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, [ph.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, closeHref]);

  const meta = statusMeta[ph.status];
  const notYet = ph.status === "draft" || ph.status === "proposed";
  const open = ["held", "checking", "awaiting_buyer", "in_review"].includes(ph.status);
  const facts: { k: string; v: React.ReactNode }[] = [
    { k: "Buyer", v: ph.buyerName ?? ph.buyerEmail ?? "No buyer yet" },
    { k: "Kind", v: ph.kind === "goods" ? "Goods" : "Service" },
    { k: "Lines", v: `${ph.test.predicates.length} in the test` },
    { k: "Created", v: formatDate(ph.createdAt) },
    { k: "Last activity", v: formatDate(ph.updatedAt) },
  ];
  if (ph.paypalOrderId)
    facts.push({ k: "PayPal order", v: <Mono>{ph.paypalOrderId}</Mono> });
  if (ph.paypalAuthorizationId)
    facts.push({ k: "Authorization", v: <Mono>{ph.paypalAuthorizationId}</Mono> });
  if (ph.releasedCents > 0)
    facts.push({ k: "Released", v: formatMoney(ph.releasedCents, ph.currency) });
  facts.push({ k: "Test hash", v: <Mono>{shortId(ph.testHash, 16)}</Mono> });
  return (
    <aside
      id="inspector"
      className={styles.inspector}
      aria-label={`Inspector: ${ph.title}`}
    >
      <div className={styles.inspectorHead}>
        <span className={styles.inspectorId}>{shortId(ph.id)}</span>
        <Link
          href={closeHref}
          className={styles.inspectorClose}
          aria-label="Close inspector"
          scroll={false}
        >
          <X aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.inspectorSeal}>
        <Seal
          id={`peek-${ph.id}`}
          amount={formatMoney(
            open ? ph.amountCents - ph.releasedCents : ph.amountCents,
            ph.currency,
          )}
          currency={ph.currency}
          segments={
            notYet
              ? ph.test.predicates.map(() => "pending" as const)
              : segmentsFor(ph.test, checks)
          }
          stamp={stampFor(ph.status)}
          pending={notYet}
          holder={holderFor(ph.status)}
          size={150}
        />
      </div>
      <h2 className={styles.inspectorTitle} tabIndex={-1} ref={title}>
        {ph.title}
      </h2>
      <div className={styles.inspectorStatus}>
        <StatusPill tone={meta.tone} pulse={ph.status === "checking"}>
          {meta.label}
        </StatusPill>
        <span>{updatedAgo}</span>
      </div>
      <Rail status={ph.status} variant="dots" still />
      <p className={styles.inspectorNext}>{nextStep}</p>
      <dl className={styles.inspectorFacts}>
        {facts.map((f) => (
          <div key={f.k}>
            <dt>{f.k}</dt>
            <dd>{f.v}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.inspectorActions}>
        <Button href={`/app/h/${ph.id}`} size="sm" icon={<ArrowRight />}>
          Open
        </Button>
        {ph.status !== "draft" ? (
          <Button href={`/app/h/${ph.id}/record`} size="sm" variant="secondary">
            Record
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
