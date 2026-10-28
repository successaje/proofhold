import { describeCheck, type AcceptanceTest } from "@/lib/domain/test";
import type { CheckResult, Status } from "@/lib/domain/proofhold";
import { latestCheckFor } from "@/lib/decision/decide";
import { VerdictIcon } from "@/components/ui/status";
import { CopyButton } from "@/components/ui/feedback";
import styles from "./proofhold.module.css";

export function TestView({
  test,
  checks,
  status,
  hash,
  threshold = 0.8,
  showChecks = true,
}: {
  test: AcceptanceTest;
  checks: CheckResult[];
  status: Status;
  hash?: string;
  threshold?: number;
  showChecks?: boolean;
}) {
  const running = status === "checking";
  const latestRound = checks.reduce((m, c) => Math.max(m, c.round), 0);
  const current = checks.filter((c) => c.round === latestRound);
  return (
    <div>
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
            <li key={p.id}>
              <div className={styles.testRow}>
                {showChecks ? (
                  <VerdictIcon
                    verdict={verdict}
                    running={running && (p.check.kind === "judgement" || !c)}
                  />
                ) : (
                  <span
                    style={{
                      width: "1.35rem",
                      textAlign: "center",
                      color: "var(--muted)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      lineHeight: "1.35rem",
                    }}
                  >
                    {i + 1}
                  </span>
                )}
                <div className={styles.testText}>
                  {p.text}
                  {!p.must_pass ? (
                    <span className={styles.optional}> · optional</span>
                  ) : null}
                </div>
                <div className={styles.testMeta}>
                  <span>{describeCheck(p.check)}</span>
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
      {hash ? (
        <div className={styles.hash} style={{ marginTop: "var(--s-3)" }}>
          <span>
            Test hash <code>{hash.slice(0, 16)}…</code>
          </span>
          <CopyButton value={hash} label="Copy full hash" />
          <span>· written into the PayPal order as custom_id</span>
        </div>
      ) : null}
    </div>
  );
}
