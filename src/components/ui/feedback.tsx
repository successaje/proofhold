"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import styles from "./feedback.module.css";

export function Skeleton({
  width = "100%",
  height = "1rem",
  style,
}: {
  width?: string;
  height?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={styles.skeleton}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.emptyTitle}>{title}</h2>
      {children ? <div className={styles.emptyBody}>{children}</div> : null}
      {action}
    </div>
  );
}

export interface Stage {
  label: string;
  state: "todo" | "active" | "done";
}

export function Stages({ stages }: { stages: Stage[] }) {
  return (
    <ol className={styles.stages} aria-label="Progress">
      {stages.map((s) => (
        <li
          key={s.label}
          className={[styles.stage, styles[`stage-${s.state}`]].join(" ")}
          aria-current={s.state === "active" ? "step" : undefined}
        >
          <span className={styles.stageMark} aria-hidden="true">
            {s.state === "done" ? <Check /> : null}
          </span>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={styles.copy}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      aria-label={label}
    >
      {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {done ? "Copied" : label}
    </button>
  );
}
