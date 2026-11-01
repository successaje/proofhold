import type { Status } from "@/lib/domain/proofhold";
import styles from "./rail.module.css";

type Step = {
  key: string;
  label: string;
  short: string;
  state: "done" | "current" | "todo" | "off";
};

/**
 * Where the proofhold is in its life: proposed, held, checking, buyer window,
 * then released or returned. The same five words are used on the landing page.
 */
export function rail(status: Status): Step[] {
  const base: [string, string][] = [
    ["Sent", "Sent"],
    ["Held", "Held"],
    ["Checking", "Checks"],
    ["Buyer window", "Window"],
  ];
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
  const steps: Step[] = base.map(([label, short], i) => ({
    key: label,
    label: i === 3 && status === "in_review" ? "In review" : label,
    short: i === 3 && status === "in_review" ? "Review" : short,
    state: i < at ? "done" : i === at ? "current" : "todo",
  }));
  const offPath = status === "cancelled" || status === "expired" || status === "voided";
  steps.push({
    key: "end",
    label: end ?? "Released",
    short: end ?? "Released",
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
          {variant === "dots" ? (
            <span className="sr-only">{s.label}</span>
          ) : (
            <>
              <span className={[styles.label, styles.long].join(" ")}>{s.label}</span>
              <span className={[styles.label, styles.short].join(" ")} aria-hidden="true">
                {s.short}
              </span>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
