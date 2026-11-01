import { TestView } from "@/components/proofhold/test-view";
import { Mark } from "@/components/shell/brand";
import type { AuditEntry } from "@/lib/audit/chain";
import type {
  CheckResult,
  Decision,
  EvidenceItem,
  Message,
} from "@/lib/domain/proofhold";
import { formatDate, formatMoney } from "@/lib/format";
import type { ProofholdView, SystemInfo } from "@/lib/view";
import { PrintButton } from "./print-button";
import styles from "./record.module.css";

/**
 * The printable record: the agreement, every check with its reasons, every
 * decision with its PayPal id, the evidence fingerprints and the hash-chained
 * history. After a capture, its first section is the receipt.
 */
export function Record({
  ph,
  sellerName,
  audience,
  checks,
  decisions,
  evidence,
  messages,
  audit,
  system,
  backHref,
}: {
  ph: ProofholdView;
  sellerName: string;
  audience: "seller" | "buyer";
  checks: CheckResult[];
  decisions: Decision[];
  evidence: EvidenceItem[];
  messages: Message[];
  audit: AuditEntry[];
  system: SystemInfo;
  backHref: string;
}) {
  // Receipt rows are the captures themselves, not later decisions that reference one.
  const captures = decisions.filter(
    (d) => d.paypalCaptureId && (d.outcome === "capture" || d.outcome === "release"),
  );
  const generated = new Date().toISOString();
  return (
    <main className={styles.page}>
      <div className={[styles.toolbar, "noPrint"].join(" ")}>
        <a href={backHref} className={styles.back}>
          ← Back
        </a>
        <PrintButton />
      </div>
      <header className={styles.head}>
        <div className={styles.brand}>
          <Mark size={22} />
          <span>Proofhold record</span>
        </div>
        <h1 className={styles.title}>{ph.title}</h1>
        <p className={styles.sub}>
          {ph.kind === "goods" ? "Goods" : "Service"} ·{" "}
          {formatMoney(ph.amountCents, ph.currency)} · {ph.statusLabel} · reference{" "}
          {ph.id}
        </p>
        <dl className={styles.parties}>
          <div>
            <dt>Seller</dt>
            <dd>{sellerName}</dd>
          </div>
          <div>
            <dt>Buyer</dt>
            <dd>{ph.buyerName ?? ph.buyerEmail ?? "—"}</dd>
          </div>
          <div>
            <dt>PayPal</dt>
            <dd>{system.paypalMode === "sandbox" ? "sandbox" : "simulated"}</dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>{formatDate(generated)}</dd>
          </div>
        </dl>
      </header>

      {captures.length > 0 ? (
        <section className={[styles.section, styles.receipt].join(" ")}>
          <h2>Receipt</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Amount</th>
                <th>PayPal capture</th>
              </tr>
            </thead>
            <tbody>
              {captures.map((d) => (
                <tr key={d.id}>
                  <td>{formatDate(d.createdAt)}</td>
                  <td>
                    {d.outcome.replace("_", " ")} by {d.actor}
                    {typeof d.rationale.reason === "string"
                      ? ` · ${d.rationale.reason}`
                      : ""}
                  </td>
                  <td className={styles.num}>
                    {formatMoney(d.amountCents, ph.currency)}
                  </td>
                  <td>
                    <code>{d.paypalCaptureId}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.fine}>
            Captured {formatMoney(ph.releasedCents, ph.currency)} of{" "}
            {formatMoney(ph.amountCents, ph.currency)}
            {ph.amountCents > ph.releasedCents
              ? `; ${formatMoney(ph.amountCents - ph.releasedCents, ph.currency)} returned to the buyer`
              : ""}
            . Order {ph.paypalOrderId ?? "—"}, authorization{" "}
            {ph.paypalAuthorizationId ?? "—"}. Standard PayPal fees apply to the seller on
            capture; nothing is charged on a void.
          </p>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2>The agreement</h2>
        <TestView
          test={ph.test}
          checks={checks}
          status={ph.status}
          hash={ph.testHash}
          showChecks={checks.length > 0}
          demoMinutes={system.demoSilenceMinutes}
          agreement={{
            seller: { name: sellerName, at: ph.sellerAgreedAt },
            buyer: { name: ph.buyerName, at: ph.buyerAgreedAt },
          }}
        />
      </section>

      {decisions.length > 0 ? (
        <section className={styles.section}>
          <h2>Decisions</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Outcome</th>
                <th>By</th>
                <th>Amount</th>
                <th>PayPal id</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.id}>
                  <td>{formatDate(d.createdAt)}</td>
                  <td>
                    {d.outcome.replace("_", " ")}
                    {typeof d.rationale.reason === "string" ? (
                      <span className={styles.reason}> {d.rationale.reason}</span>
                    ) : null}
                  </td>
                  <td>{d.actor}</td>
                  <td className={styles.num}>
                    {formatMoney(d.amountCents, ph.currency)}
                  </td>
                  <td>
                    <code>{d.paypalCaptureId ?? d.paypalDisputeId ?? "—"}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {evidence.length > 0 ? (
        <section className={styles.section}>
          <h2>Evidence</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Fingerprint</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {evidence.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>
                    {e.kind === "tracking" ? "tracking number" : (e.mime ?? "file")}
                  </td>
                  <td>
                    <code>{e.sha256 ? `sha256 ${e.sha256}` : "—"}</code>
                  </td>
                  <td>{formatDate(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {messages.length > 0 ? (
        <section className={styles.section}>
          <h2>Messages</h2>
          <ul className={styles.messages}>
            {messages.map((m) => (
              <li key={m.id}>
                <span className={styles.who}>
                  {m.author === "seller" ? sellerName : (ph.buyerName ?? "Buyer")} ·{" "}
                  {formatDate(m.createdAt)}
                </span>
                <span>{m.body}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2>History</h2>
        <p className={styles.fine}>
          {audit.length} entries. Each entry's hash covers the one before it, so an edited
          record would not verify. The JSON bundle{" "}
          {audience === "seller" ? "from the proofhold page" : "from your page"} contains
          the full chain.
        </p>
        <ol className={styles.audit}>
          {audit.map((e) => (
            <li key={e.id}>
              <span className={styles.when}>{formatDate(e.createdAt)}</span>
              <span className={styles.type}>{e.type.replace(/_/g, " ")}</span>
              <code className={styles.hash}>
                #{e.seq} {e.hash.slice(0, 12)}
              </code>
            </li>
          ))}
        </ol>
      </section>

      <footer className={styles.foot}>
        Proofhold never holds the money. PayPal holds it under the test above, and only a
        recorded decision moves it. Test hash {ph.testHash}.
      </footer>
    </main>
  );
}
