import { Panel } from "@/components/ui/panel";
import { Badge, Mono, StatusPill } from "@/components/ui/status";
import { formatDate, formatMoney } from "@/lib/format";
import type { ProofholdView, SystemInfo } from "@/lib/view";
import { Countdown } from "./countdown";
import styles from "./proofhold.module.css";

export function HoldCard({
  ph,
  system,
  audience,
}: {
  ph: ProofholdView;
  system: SystemInfo;
  audience: "seller" | "buyer";
}) {
  const held = ["held", "checking", "awaiting_buyer", "in_review"].includes(ph.status);
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
          <>ends {formatDate(ph.honorPeriodEndsAt)}</>
        ) : ph.reauthorizedAt ? (
          "ended · reauthorized once"
        ) : (
          "ended · funds checked at capture"
        ),
    });
  if (ph.releasedCents > 0)
    lines.push({ k: "Released", v: formatMoney(ph.releasedCents, ph.currency) });
  if (ph.payerEmail && audience === "seller")
    lines.push({ k: "Paid by", v: ph.payerEmail });
  if (ph.paypalDisputeId)
    lines.push({ k: "Dispute", v: <Mono>{ph.paypalDisputeId}</Mono> });

  return (
    <Panel
      title="PayPal hold"
      tone={ph.statusTone === "neutral" ? undefined : ph.statusTone}
      actions={
        <StatusPill tone={ph.statusTone} pulse={ph.status === "checking"}>
          {ph.statusLabel}
        </StatusPill>
      }
    >
      <div className={styles.holdAmount}>
        {formatMoney(held ? remaining : ph.amountCents, ph.currency)}
      </div>
      <p className={styles.holdSub}>
        {ph.status === "draft" || ph.status === "proposed"
          ? "Not held yet. Approval creates a PayPal authorization for this amount."
          : held
            ? audience === "buyer"
              ? "Held by PayPal in your account. Proofhold cannot move it; only the test can."
              : "Held by PayPal, not by Proofhold. Captured only through a recorded decision."
            : ph.statusSummary}
      </p>
      {ph.status === "awaiting_buyer" && ph.silenceWindowEndsAt ? (
        <p className={styles.holdSub}>
          Buyer window closes <Countdown to={ph.silenceWindowEndsAt} />
          {system.demoSilenceMinutes ? (
            <> (shortened to {system.demoSilenceMinutes} min for the demo)</>
          ) : null}
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
      <div style={{ marginTop: "var(--s-4)" }}>
        <Badge>
          {system.paypalMode === "sandbox" ? "PayPal sandbox" : "Simulated PayPal"}
        </Badge>
      </div>
    </Panel>
  );
}
