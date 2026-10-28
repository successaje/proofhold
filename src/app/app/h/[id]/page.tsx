import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/proofhold/auto-refresh";
import { DecisionNote } from "@/components/proofhold/decision-card";
import { DeliverPanel } from "@/components/proofhold/deliver-panel";
import { DraftEditor } from "@/components/proofhold/draft-editor";
import { EvidenceList } from "@/components/proofhold/evidence-list";
import { History } from "@/components/proofhold/history";
import { HoldCard } from "@/components/proofhold/hold-card";
import { NextStep } from "@/components/proofhold/next-step";
import { Rail } from "@/components/proofhold/rail";
import {
  BundleButton,
  CancelButton,
  ReuseButton,
  DisputeActions,
  EndHoldButton,
  OfferForm,
  ReopenButton,
} from "@/components/proofhold/seller-actions";
import { ShareLink } from "@/components/proofhold/share-link";
import { TestView } from "@/components/proofhold/test-view";
import { PageHeader } from "@/components/shell/page-header";
import { Stages } from "@/components/ui/feedback";
import { KeyValues, Note, Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status";
import { config } from "@/lib/config";
import { formatDate, formatMoney } from "@/lib/format";
import { currentWorkspace } from "@/lib/session/workspace";
import { db } from "@/lib/store/sql";
import {
  getProofhold,
  listAudit,
  listChecks,
  listDecisions,
  listEvidence,
  listMessages,
} from "@/lib/store/repos";
import { sellerView, systemInfo } from "@/lib/view";
import pageStyles from "./detail.module.css";
import styles from "@/components/proofhold/proofhold.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ph = await getProofhold(await db(), id);
  return { title: ph?.title ?? "Proofhold" };
}

export default async function ProofholdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { id } = await params;
  const { sent } = await searchParams;
  const ws = (await currentWorkspace())!;
  const sql = await db();
  const raw = await getProofhold(sql, id);
  if (!raw || raw.workspaceId !== ws.id) notFound();
  const [evidence, checks, decisions, messages, audit] = await Promise.all([
    listEvidence(sql, raw.id),
    listChecks(sql, raw.id),
    listDecisions(sql, raw.id),
    listMessages(sql, raw.id),
    listAudit(sql, raw.id),
  ]);
  const ph = sellerView(raw);
  const system = systemInfo();
  const threshold = config().EXAMINER_CONFIDENCE_THRESHOLD;
  const s = ph.status;
  const held = ["held", "checking", "awaiting_buyer", "in_review"].includes(s);
  const objection = [...messages].reverse().find((m) => m.author === "buyer");
  const captures = decisions.filter((d) => d.paypalCaptureId);

  return (
    <>
      <AutoRefresh
        active={
          s === "checking" ||
          s === "proposed" ||
          s === "awaiting_buyer" ||
          s === "in_review" ||
          s === "disputed"
        }
        every={s === "checking" ? 2500 : 8000}
      />
      <PageHeader
        eyebrow={
          <>
            <Link href="/app">Proofholds</Link>
            <span>/</span>
            <span>{ph.kind === "goods" ? "Goods" : "Service"}</span>
          </>
        }
        title={ph.title}
        lead={
          <span className={pageStyles.lead}>
            <span className={pageStyles.leadLine}>
              <StatusPill tone={ph.statusTone} pulse={s === "checking"}>
                {ph.statusLabel}
              </StatusPill>
              <span>{ph.statusSummary}</span>
            </span>
            <Rail status={s} />
          </span>
        }
        actions={
          <>
            {s === "draft" || s === "proposed" ? <CancelButton ph={ph} /> : null}
            {held && s !== "checking" ? <EndHoldButton ph={ph} /> : null}
            {!["draft"].includes(s) ? <BundleButton ph={ph} /> : null}
            {s !== "draft" ? <ReuseButton ph={ph} /> : null}
          </>
        }
      />

      <div className={pageStyles.layout}>
        <div className={pageStyles.main}>
          {sent ? (
            <Note tone="pass">
              <strong>Sent.</strong> Share the link below. You will see the hold here the
              moment the buyer approves.
            </Note>
          ) : null}

          <NextStep ph={ph} />

          {s === "proposed" ? (
            <Panel
              title="Share with the buyer"
              subtitle="The buyer reads the same test, then approves with PayPal. Nothing is held until they do."
            >
              <ShareLink url={ph.buyerUrl} />
            </Panel>
          ) : null}

          {s === "draft" ? (
            <Panel
              title="Acceptance test"
              subtitle="Edit until it says exactly what done means. The buyer approves this text."
            >
              <DraftEditor ph={ph} />
            </Panel>
          ) : (
            <Panel
              title="Acceptance test"
              subtitle={
                ph.buyerAgreedAt
                  ? `Agreed by both sides · buyer approved ${formatDate(ph.buyerAgreedAt)}`
                  : ph.sellerAgreedAt
                    ? `You agreed ${formatDate(ph.sellerAgreedAt)} · waiting for the buyer`
                    : undefined
              }
            >
              <TestView
                test={ph.test}
                checks={checks}
                status={s}
                hash={ph.testHash}
                threshold={threshold}
                showChecks={!["proposed", "cancelled"].includes(s)}
                agreement={{
                  seller: { name: ws.name, at: ph.sellerAgreedAt },
                  buyer: { name: ph.buyerName, at: ph.buyerAgreedAt },
                }}
              />
            </Panel>
          )}

          {s === "checking" ? (
            <Panel
              title="Checking"
              subtitle="Deterministic checks first; the examiner judges only what a machine cannot measure."
            >
              <Stages
                stages={[
                  { label: "Files measured and counted", state: "done" },
                  {
                    label: system.aiAvailable
                      ? "Examiner reviewing judgement lines (may abstain)"
                      : "Examiner off: judgement lines go to the buyer",
                    state: system.aiAvailable ? "active" : "done",
                  },
                  { label: "Decision recorded, buyer window opens", state: "todo" },
                ]}
              />
            </Panel>
          ) : null}

          {s === "awaiting_buyer" || s === "in_review" ? (
            <DecisionNote ph={ph} audience="seller" />
          ) : null}

          {s === "in_review" ? (
            <Panel
              title="Review"
              subtitle="The buyer objected. You can offer a partial release, fix and resubmit, or end the hold."
            >
              <div className={styles.stack}>
                {objection ? (
                  <blockquote
                    className={[styles.message, styles["message-buyer"]].join(" ")}
                  >
                    “{objection.body}”
                    <span className={styles.messageMeta}>
                      Buyer · {formatDate(objection.createdAt)}
                    </span>
                  </blockquote>
                ) : null}
                <OfferForm ph={ph} />
                <div className={styles.actionsRow}>
                  <ReopenButton ph={ph} />
                </div>
              </div>
            </Panel>
          ) : null}

          {s === "held" || s === "awaiting_buyer" ? (
            <DeliverPanel ph={ph} evidence={evidence} aiAvailable={system.aiAvailable} />
          ) : null}

          {s === "disputed" ? (
            <Panel title="PayPal dispute" tone="fail">
              <DisputeActions ph={ph} system={system} />
            </Panel>
          ) : null}

          {(s === "released" ||
            s === "partially_released" ||
            s === "refunded" ||
            s === "voided" ||
            s === "expired") &&
          captures.length + decisions.length > 0 ? (
            <Panel
              title="Outcome"
              tone={ph.statusTone === "neutral" ? undefined : ph.statusTone}
            >
              <div className={styles.outcome}>
                <span className={styles.outcomeTitle}>
                  {s === "released"
                    ? `${formatMoney(ph.releasedCents, ph.currency)} released to you`
                    : s === "partially_released"
                      ? `${formatMoney(ph.releasedCents, ph.currency)} released · ${formatMoney(ph.amountCents - ph.releasedCents, ph.currency)} returned`
                      : s === "refunded"
                        ? "PayPal refunded the buyer"
                        : s === "voided"
                          ? "Hold returned to the buyer"
                          : "Hold expired"}
                </span>
                <span className={styles.outcomeBody}>{ph.statusSummary}</span>
              </div>
              <div style={{ marginTop: "var(--s-4)" }}>
                <KeyValues
                  items={decisions.map((d) => ({
                    k: `${d.outcome.replace("_", " ")} · ${formatDate(d.createdAt)}`,
                    v: (
                      <>
                        {formatMoney(d.amountCents, ph.currency)} by {d.actor}
                        {d.paypalCaptureId ? (
                          <>
                            {" "}
                            · capture <code>{d.paypalCaptureId}</code>
                          </>
                        ) : null}
                        {d.paypalDisputeId ? (
                          <>
                            {" "}
                            · dispute <code>{d.paypalDisputeId}</code>
                          </>
                        ) : null}
                        {typeof d.rationale.reason === "string" ? (
                          <> · {d.rationale.reason}</>
                        ) : null}
                      </>
                    ),
                  }))}
                />
              </div>
            </Panel>
          ) : null}

          {evidence.length > 0 && !(s === "held" || s === "awaiting_buyer") ? (
            <Panel
              title="Evidence"
              subtitle={
                ph.evidenceSubmittedAt
                  ? `Submitted ${formatDate(ph.evidenceSubmittedAt)}`
                  : undefined
              }
            >
              <EvidenceList items={evidence} />
            </Panel>
          ) : null}

          <Panel title="Brief">
            <p
              style={{
                whiteSpace: "pre-wrap",
                color: "var(--ink-2)",
                fontSize: "var(--text-md)",
              }}
            >
              {ph.brief}
            </p>
          </Panel>
        </div>

        <aside className={pageStyles.aside}>
          <HoldCard ph={ph} checks={checks} system={system} audience="seller" />
          <Panel title="Buyer">
            <KeyValues
              items={[
                { k: "Name", v: ph.buyerName ?? "—" },
                { k: "Email", v: ph.buyerEmail ?? ph.payerEmail ?? "—" },
                {
                  k: "Link",
                  v:
                    s === "draft" ? (
                      "Available after you send"
                    ) : (
                      <ShareLinkInline url={ph.buyerUrl} />
                    ),
                },
              ]}
            />
          </Panel>
          <Panel title="History" subtitle={`${audit.length} entries, hash-chained`}>
            <History audit={audit} currency={ph.currency} />
          </Panel>
        </aside>
      </div>
    </>
  );
}

function ShareLinkInline({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{ color: "var(--brand)", overflowWrap: "anywhere" }}
    >
      Open buyer page
    </a>
  );
}
