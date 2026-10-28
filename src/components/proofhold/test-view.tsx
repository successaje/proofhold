import { describeCheck, type AcceptanceTest } from "@/lib/domain/test";
import type { CheckResult, Status } from "@/lib/domain/proofhold";
import { latestCheckFor } from "@/lib/decision/decide";
import { VerdictIcon } from "@/components/ui/status";
import { CopyButton } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";
import styles from "./proofhold.module.css";

export interface Agreement {
  seller?: { name: string; at: string | null } | null;
  buyer?: { name: string | null; at: string | null } | null;
}

/**
 * The Sheet: the acceptance test as a ruled page. A numbered margin, one line
 * per predicate with its check in monospace and its verdict, the release rules,
 * and at the foot the agreement: who agreed, when, and the hash PayPal holds.
 */
export function TestView({
  test,
  checks,
  status,
  hash,
  threshold = 0.8,
  showChecks = true,
  agreement,
}: {
  test: AcceptanceTest;
  checks: CheckResult[];
  status: Status;
  hash?: string;
  threshold?: number;
  showChecks?: boolean;
  agreement?: Agreement;
}) {
  const running = status === "checking";
  const latestRound = checks.reduce((m, c) => Math.max(m, c.round), 0);
  const current = checks.filter((c) => c.round === latestRound);
  return (
    <div className={styles.sheet}>
      <p className={styles.summary}>{test.summary}</p>
      <ol className={styles.testList}>
        {test.predicates.map((p, i) => {
          const c = showChecks ? latestCheckFor(current, p.id) : undefined;
          const verdict = c?.verdict ?? "pending";
          const low =
            c?.source === "examiner" &&
            c.verdict === "pass" &&
            (c.confidence ?? 0) < threshold;
          return (
            <li key={p.id} className={styles.line}>
              <span className={styles.lineNo} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className={styles.lineBody}>
                <div className={styles.lineHead}>
                  <span className={styles.testText}>
                    {p.text}
                    {!p.must_pass ? (
                      <span className={styles.optional}> · optional</span>
                    ) : null}
                  </span>
                  {showChecks ? (
                    <VerdictIcon
                      verdict={verdict}
                      running={running && (p.check.kind === "judgement" || !c)}
                    />
                  ) : null}
                </div>
                <div className={styles.testMeta}>
                  <code>{describeCheck(p.check)}</code>
                  {c ? (
                    <>
                      <span className={styles.sep} />
                      <span>
                        {c.source === "validator" || c.source === "tracking"
                          ? "checked automatically"
                          : c.source === "examiner"
                            ? "examiner"
                            : "buyer"}
                        {c.confidence !== null && c.source === "examiner" ? (
                          <span className={styles.confidence}>
                            {" "}
                            · {Math.round(c.confidence * 100)}% confident
                            {low ? " (below the release threshold)" : ""}
                          </span>
                        ) : null}
                      </span>
                    </>
                  ) : null}
                </div>
                {c && c.reasons.length > 0 ? (
                  <ul
                    className={[
                      styles.reasons,
                      c.verdict === "fail" && styles["reasons-fail"],
                      c.verdict === "abstain" && styles["reasons-abstain"],
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {c.reasons.slice(0, 4).map((r, j) => (
                      <li key={j}>{r}</li>
                    ))}
                    {typeof c.detail.whatWouldResolve === "string" &&
                    c.verdict !== "pass" ? (
                      <li className={styles.resolve}>
                        What would settle it: {c.detail.whatWouldResolve}
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <p className={styles.rules}>
        Buyer window: {test.rules.silence_window_hours} h after the checks finish.{" "}
        {test.rules.partial_release.length > 0
          ? test.rules.partial_release
              .map((r) => {
                const idx = r.when_passed
                  .map((id) => test.predicates.findIndex((p) => p.id === id) + 1)
                  .filter((n) => n > 0);
                return `If only ${idx.length === 1 ? "line" : "lines"} ${idx.join(", ")} pass and the buyer stays silent, ${Math.round(r.fraction * 100)}% releases and the rest is returned.`;
              })
              .join(" ")
          : "No partial release: every required line must pass, or the buyer must confirm."}
      </p>
      {agreement ? (
        <div className={styles.agreement}>
          <div className={styles.signature}>
            <span className={styles.signatureLabel}>Seller</span>
            <span className={styles.signatureName}>{agreement.seller?.name ?? "—"}</span>
            <span className={styles.signatureAt}>
              {agreement.seller?.at
                ? `agreed ${formatDate(agreement.seller.at)}`
                : "not yet"}
            </span>
          </div>
          <div className={styles.signature}>
            <span className={styles.signatureLabel}>Buyer</span>
            <span className={styles.signatureName}>
              {agreement.buyer?.name ?? (agreement.buyer?.at ? "Buyer" : "—")}
            </span>
            <span className={styles.signatureAt}>
              {agreement.buyer?.at
                ? `approved ${formatDate(agreement.buyer.at)}`
                : "awaiting approval"}
            </span>
          </div>
        </div>
      ) : null}
      {hash ? (
        <div className={styles.hash}>
          <span className={styles.hashLabel}>Test hash</span>
          <code className={styles.hashValue} title={hash}>
            {hash}
          </code>
          <CopyButton value={hash} label="Copy" />
          <span className={styles.hashNote}>
            written into the PayPal order as custom_id
          </span>
        </div>
      ) : null}
    </div>
  );
}
