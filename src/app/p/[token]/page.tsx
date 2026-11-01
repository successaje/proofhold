import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/proofhold/auto-refresh";
import { DecisionNote } from "@/components/proofhold/decision-card";
import { EvidenceList } from "@/components/proofhold/evidence-list";
import { HoldCard } from "@/components/proofhold/hold-card";
import { Rail } from "@/components/proofhold/rail";
import { TestView } from "@/components/proofhold/test-view";
import { BuyerShell } from "@/components/shell/buyer-shell";
import { ToastProvider } from "@/components/ui/toast";
import { Note, Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status";
import { config } from "@/lib/config";
import { formatDate, formatMoney } from "@/lib/format";
import { db } from "@/lib/store/sql";
import {
  getProofholdByToken,
  getWorkspace,
  listChecks,
  listDecisions,
  listEvidence,
  listMessages,
} from "@/lib/store/repos";
import { proofholdView, systemInfo } from "@/lib/view";
import { ApproveForm, BuyerResponse, DisputeDemo, OfferResponse } from "./buyer-actions";
import styles from "./buyer.module.css";
import shared from "@/components/proofhold/proofhold.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const ph = await getProofholdByToken(await db(), token);
  return {
    title: ph ? `${ph.title} · ${formatMoney(ph.amountCents, ph.currency)}` : "Proofhold",
    robots: { index: false },
  };
}

export default async function BuyerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ approved?: string; cancelled?: string; error?: string }>;
}) {
  const { token } = await params;
  const flags = await searchParams;
  const sql = await db();
  const raw = await getProofholdByToken(sql, token);
  if (!raw || raw.status === "draft") notFound();
  const [evidence, checks, decisions, messages, seller] = await Promise.all([
    listEvidence(sql, raw.id),
    listChecks(sql, raw.id),
    listDecisions(sql, raw.id),
    listMessages(sql, raw.id),
    getWorkspace(sql, raw.workspaceId),
  ]);
  const ph = proofholdView(raw);
  const system = systemInfo();
  const s = ph.status;
  const threshold = config().EXAMINER_CONFIDENCE_THRESHOLD;
  const sellerNote = [...messages].reverse().find((m) => m.author === "seller");
  const sellerName = seller?.name ?? "The seller";
  const blocked =
    (ph.decision as { outcome?: { kind?: string } } | null)?.outcome?.kind === "blocked";

  return (
    <ToastProvider>
      <BuyerShell system={system}>
        <AutoRefresh
          active={s === "checking" || s === "held" || s === "in_review"}
          every={s === "checking" ? 2500 : 8000}
        />
        <header className={styles.header}>
          <p className={styles.from}>{sellerName} sent you a payment hold to approve</p>
          <h1 className={styles.title}>{ph.title}</h1>
          <p className={styles.amountLine}>
            <span className={styles.amount}>{ph.amount}</span>
            <StatusPill tone={ph.statusTone} pulse={s === "checking"}>
              {ph.statusLabel}
            </StatusPill>
          </p>
          <div className={styles.rail}>
            <Rail status={s} />
          </div>
        </header>

        {flags.error ? <Note tone="fail">{decodeURIComponent(flags.error)}</Note> : null}
        {flags.cancelled && s === "proposed" ? (
          <Note tone="neutral">
            You left PayPal without approving. Nothing was held. You can try again below.
          </Note>
        ) : null}
        {flags.approved && (s === "held" || s === "checking") ? (
          <Note tone="pass">
            <strong>Approved.</strong> PayPal is holding {ph.amount}. It only moves if the
            test below is met, or you say so.
          </Note>
        ) : null}

        <div className={styles.stack}>
          {s === "proposed" ? (
            <Panel
              title="What you are agreeing to"
              subtitle="Read it as a contract. PayPal will hold the money until this test is met."
            >
              <TestView
                test={ph.test}
                checks={[]}
                status={s}
                hash={ph.testHash}
                showChecks={false}
                demoMinutes={system.demoSilenceMinutes}
                examinerOff={!system.aiAvailable}
                agreement={{
                  seller: { name: sellerName, at: ph.sellerAgreedAt },
                  buyer: { name: ph.buyerName, at: null },
                }}
              />
              <div className={styles.explain}>
                <p>
                  <strong>How the hold works.</strong> Approving creates a PayPal
                  authorization for {ph.amount}. PayPal keeps the money in your account,
                  reserved. Proofhold never receives it.
                </p>
                <p>
                  <strong>How it releases.</strong> When {sellerName} submits evidence,
                  deterministic checks run first, then an examiner judges the lines a
                  machine cannot. If every required line passes you get{" "}
                  {ph.test.rules.silence_window_hours} hours to object before PayPal
                  captures. If a line fails or the examiner is unsure, nothing is captured
                  unless you confirm.
                </p>
                <p>
                  <strong>How you get out.</strong> Object within the window and the
                  seller can offer a partial release or return the hold. The authorization
                  lapses on its own after 29 days.
                </p>
              </div>
              <ApproveForm token={token} ph={ph} system={system} />
            </Panel>
          ) : null}

          {s !== "proposed" ? (
            <>
              {s === "voided" || s === "expired" || s === "cancelled" ? (
                <Note tone="neutral">
                  <strong>Nothing was charged.</strong>{" "}
                  {s === "cancelled"
                    ? `${sellerName} cancelled this before anything was held.`
                    : s === "expired"
                      ? "The authorization lapsed before a decision, so PayPal released the reservation."
                      : "The hold was returned to you in full."}{" "}
                  If PayPal still shows the reservation, it clears within a few days
                  depending on your bank.
                </Note>
              ) : null}

              {s === "awaiting_buyer" || s === "in_review" ? (
                <DecisionNote ph={ph} audience="buyer" />
              ) : null}

              {s === "in_review" && ph.offerCents ? (
                <Panel title="The seller made an offer" tone="held">
                  <OfferResponse token={token} ph={ph} />
                </Panel>
              ) : null}

              {s === "awaiting_buyer" || s === "held" ? (
                <Panel
                  title={s === "held" ? "Waiting for delivery" : "Your decision"}
                  subtitle={
                    s === "held"
                      ? `${sellerName} has not submitted evidence yet. The hold stays reserved until they do.`
                      : blocked
                        ? "Confirm to release, or object with a reason. There is no deadline: nothing moves until you do one or the other."
                        : "Confirm to release now, or object with a reason. If you do nothing, the hold releases when the window closes."
                  }
                >
                  <BuyerResponse token={token} ph={ph} />
                </Panel>
              ) : null}

              <Panel
                title="The test"
                subtitle={
                  ph.buyerAgreedAt
                    ? `You approved this on ${formatDate(ph.buyerAgreedAt)}`
                    : undefined
                }
              >
                <TestView
                  test={ph.test}
                  checks={checks}
                  status={s}
                  hash={ph.testHash}
                  threshold={threshold}
                  showChecks={s !== "cancelled"}
                  demoMinutes={system.demoSilenceMinutes}
                  examinerOff={!system.aiAvailable}
                  agreement={{
                    seller: { name: sellerName, at: ph.sellerAgreedAt },
                    buyer: { name: ph.buyerName, at: ph.buyerAgreedAt },
                  }}
                />
              </Panel>

              {evidence.length > 0 ? (
                <Panel
                  title="What the seller submitted"
                  subtitle={
                    ph.evidenceSubmittedAt
                      ? formatDate(ph.evidenceSubmittedAt)
                      : undefined
                  }
                >
                  {sellerNote ? (
                    <blockquote
                      className={[shared.message, shared["message-seller"]].join(" ")}
                      style={{ marginBottom: "var(--s-3)" }}
                    >
                      “{sellerNote.body}”
                      <span className={shared.messageMeta}>
                        {sellerName} · {formatDate(sellerNote.createdAt)}
                      </span>
                    </blockquote>
                  ) : null}
                  <EvidenceList items={evidence} token={token} />
                </Panel>
              ) : null}

              {s === "released" || s === "partially_released" ? (
                <DisputeDemo
                  token={token}
                  ph={ph}
                  system={system}
                  decisions={decisions}
                />
              ) : null}
            </>
          ) : null}

          <HoldCard ph={ph} checks={checks} system={system} audience="buyer" />
          {s !== "proposed" ? (
            <p className={styles.fine}>
              <a href={`/api/p/${token}/bundle`} className={styles.recordLink}>
                Download the full record
              </a>{" "}
              · the agreed test and its hash, every check with its reasons, file
              fingerprints and the hash-chained history. The seller can download the same
              file.
            </p>
          ) : null}
        </div>
      </BuyerShell>
    </ToastProvider>
  );
}
