import { Panel } from "@/components/ui/panel";
import { Badge, Mono } from "@/components/ui/status";
import { formatDate, formatMoney } from "@/lib/format";
import type { CheckResult } from "@/lib/domain/proofhold";
import type { ProofholdView, SystemInfo } from "@/lib/view";
import { Countdown } from "./countdown";
import { Seal, segmentsFor, stampFor } from "./seal";
import styles from "./proofhold.module.css";

export function HoldCard({
  ph,
  checks = [],
  system,
  audience,
}: {
  ph: ProofholdView;
  checks?: CheckResult[];
  system: SystemInfo;
  audience: "seller" | "buyer";
}) {
  const held = ["held", "checking", "awaiting_buyer", "in_review"].includes(ph.status);
  const notYet = ph.status === "draft" || ph.status === "proposed";
  const remaining = ph.amountCents - ph.releasedCents;
  const lines: { k: string; v: React.ReactNode }[] = [];
  if (ph.paypalOrderId)
    lines.push({ k: "PayPal order", v: <Mono>{ph.paypalOrderId}</Mono> });
  if (ph.paypalAuthorizationId)
    lines.push({ k: "Authorization", v: <Mono>{ph.paypalAuthorizationId}</Mono> });
  if (ph.authorizationExpiresAt && held)
    lines.push({ k: "Hold valid until", v: formatDate(ph.authorizationExpiresAt) });
  if (ph.honorPeriodEndsAt && held)
    lines.push({
      k: "Honor period",
      v:
        Date.parse(ph.honorPeriodEndsAt) > Date.now() ? (
          <span title="PayPal guarantees the funds for three days after approval. After that a capture can still succeed, but the funds are checked again.">
            funds guaranteed until {formatDate(ph.honorPeriodEndsAt)}
          </span>
        ) : ph.reauthorizedAt ? (
          "ended · reauthorized once, funds guaranteed again"
        ) : (
          "ended · funds are checked again at capture"
        ),
    });
  if (ph.releasedCents > 0)
    lines.push({ k: "Released", v: formatMoney(ph.releasedCents, ph.currency) });
  if (ph.payerEmail && audience === "seller")
    lines.push({ k: "Paid by", v: ph.payerEmail });
  if (ph.paypalDisputeId)
    lines.push({ k: "Dispute", v: <Mono>{ph.paypalDisputeId}</Mono> });

  const stamp = stampFor(ph.status);
  const outcome = (ph.decision as { outcome?: { kind?: string } } | null)?.outcome?.kind;
  const blocked = outcome === "blocked";
  return (
    <Panel
      title="PayPal hold"
      tone={ph.statusTone === "neutral" ? undefined : ph.statusTone}
      actions={
        <Badge>
          {system.paypalMode === "sandbox" ? "PayPal sandbox" : "Simulated PayPal"}
        </Badge>
      }
    >
      <div className={styles.holdSeal}>
        <Seal
          id={`seal-${ph.id}`}
          amount={formatMoney(held ? remaining : ph.amountCents, ph.currency)}
          currency={ph.currency}
          segments={
            notYet
              ? ph.test.predicates.map(() => "pending" as const)
              : segmentsFor(ph.test, checks)
          }
          stamp={stamp}
          pending={notYet}
          holder={notYet ? "Not held yet" : "Held by PayPal"}
        />
      </div>
      <p className={styles.holdSub}>
        {notYet
          ? "Not held yet. Approval creates a PayPal authorization for this amount."
          : held
            ? audience === "buyer"
              ? "Held by PayPal in your account. Proofhold cannot move it; only the test can."
              : "Held by PayPal, not by Proofhold. Captured only through a recorded decision."
            : ph.statusSummary}
      </p>
      {ph.status === "awaiting_buyer" && ph.silenceWindowEndsAt && !blocked ? (
        <p className={styles.holdSub}>
          Releases <Countdown to={ph.silenceWindowEndsAt} /> unless the buyer objects
          {system.demoSilenceMinutes ? (
            <> (window shortened to {system.demoSilenceMinutes} min for the demo)</>
          ) : null}
        </p>
      ) : null}
      {ph.status === "awaiting_buyer" && blocked ? (
        <p className={styles.holdSub}>
          No deadline: nothing moves until the buyer confirms or objects.
        </p>
      ) : null}
      {lines.length > 0 ? (
        <dl style={{ marginTop: "var(--s-4)" }}>
          {lines.map((l) => (
            <div key={l.k} className={styles.holdLine}>
              <dt>{l.k}</dt>
              <dd>{l.v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Panel>
  );
}
