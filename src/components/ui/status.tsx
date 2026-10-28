import type { ReactNode } from "react";
import { Check, HelpCircle, Minus, X } from "lucide-react";
import styles from "./status.module.css";

export type Tone = "neutral" | "held" | "pass" | "fail" | "info";

export function StatusPill({
  tone,
  children,
  pulse,
}: {
  tone: Tone;
  children: ReactNode;
  pulse?: boolean;
}) {
  return (
    <span
      className={[styles.pill, styles[tone], pulse && styles.pulse]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}

export function Badge({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <span className={styles.badge} title={title}>
      {icon}
      {children}
    </span>
  );
}

export function Mono({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <code className={[styles.mono, className].filter(Boolean).join(" ")}>{children}</code>
  );
}

export function VerdictIcon({
  verdict,
  running,
}: {
  verdict: "pass" | "fail" | "abstain" | "pending";
  running?: boolean;
}) {
  const labels = {
    pass: "Passed",
    fail: "Failed",
    abstain: "Examiner abstained",
    pending: "Pending",
  };
  if (verdict === "pending" && running)
    return (
      <span
        className={[
          styles.verdict,
          styles["verdict-pending"],
          styles["verdict-running"],
        ].join(" ")}
        role="img"
        aria-label="Checking"
      >
        <span className={styles.dot} />
      </span>
    );
  const Icon =
    verdict === "pass"
      ? Check
      : verdict === "fail"
        ? X
        : verdict === "abstain"
          ? HelpCircle
          : Minus;
  return (
    <span
      className={[styles.verdict, styles[`verdict-${verdict}`]].join(" ")}
      role="img"
      aria-label={labels[verdict]}
    >
      <Icon aria-hidden="true" />
    </span>
  );
}
