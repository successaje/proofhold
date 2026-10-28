import type { ReactNode } from "react";
import styles from "./timeline.module.css";

export interface TimelineItem {
  key: string;
  title: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  tone?: "neutral" | "pass" | "held" | "fail" | "info";
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className={styles.list}>
      {items.map((it) => (
        <li
          key={it.key}
          className={[
            styles.item,
            it.tone && it.tone !== "neutral" && styles[`item-${it.tone}`],
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className={styles.title}>{it.title}</span>
          {it.detail ? <span className={styles.detail}>{it.detail}</span> : null}
          {it.meta ? <span className={styles.meta}>{it.meta}</span> : null}
        </li>
      ))}
    </ol>
  );
}
