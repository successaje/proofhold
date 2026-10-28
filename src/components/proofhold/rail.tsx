import type { Status } from "@/lib/domain/proofhold";
import styles from "./rail.module.css";

type Step = { key: string; label: string; state: "done" | "current" | "todo" | "off" };

/**
 * Where the proofhold is in its life: proposed, held, checking, buyer window,
 * then released or returned. The same five words are used on the landing page.
 */
export function rail(status: Status): Step[] {
  const base = ["Proposed", "Held", "Checking", "Buyer window"];
  const index: Partial<Record<Status, number>> = {
    draft: -1,
    proposed: 0,
    held: 1,
    checking: 2,
    awaiting_buyer: 3,
    in_review: 3,
  };
  const endLabel: Partial<Record<Status, string>> = {
    released: "Released",
    partially_released: "Part released",
    voided: "Returned",
    refunded: "Refunded",
    disputed: "Disputed",
    expired: "Expired",
    cancelled: "Cancelled",
  };
  const end = endLabel[status];
  const at = end ? 4 : (index[status] ?? -1);
  const steps: Step[] = base.map((label, i) => ({
    key: label,
    label: i === 3 && status === "in_review" ? "In review" : label,
    state: i < at ? "done" : i === at ? "current" : "todo",
  }));
  const offPath = status === "cancelled" || status === "expired" || status === "voided";
  steps.push({
    key: "end",
    label: end ?? "Released",
    state: end ? (offPath ? "off" : "current") : "todo",
  });
  return steps;
}

export function Rail({
  status,
  compact = false,
  variant = "labels",
}: {
  status: Status;
  compact?: boolean;
  /** "dots" draws the five steps without text; each dot keeps its name for assistive tech. */
  variant?: "labels" | "dots";
}) {
  const steps = rail(status);
  const current = steps.find((s) => s.state === "current" || s.state === "off");
  return (
    <ol
      className={[
        styles.rail,
        compact && styles.compact,
        variant === "dots" && styles.dots,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={current ? `Progress: ${current.label}` : "Progress"}
    >
      {steps.map((s) => (
        <li
          key={s.key}
          className={[styles.step, styles[`step-${s.state}`]].join(" ")}
          aria-current={s.state === "current" ? "step" : undefined}
          title={variant === "dots" ? s.label : undefined}
        >
          <span className={styles.dot} aria-hidden="true" />
          <span className={variant === "dots" ? "sr-only" : styles.label}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
