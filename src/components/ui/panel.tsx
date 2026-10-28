import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock, Info } from "lucide-react";
import styles from "./panel.module.css";

export function Panel({
  title,
  subtitle,
  actions,
  children,
  footer,
  flush,
  divided,
  tone,
  className,
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  divided?: boolean;
  tone?: "held" | "pass" | "fail";
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={[
        styles.panel,
        flush && styles.flush,
        tone && styles[`tone-${tone}`],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {title || actions ? (
        <header className={styles.header}>
          <div>
            {title ? <h2 className={styles.title}>{title}</h2> : null}
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </header>
      ) : null}
      <div className={[styles.body, divided && styles.divided].filter(Boolean).join(" ")}>
        {children}
      </div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </section>
  );
}

export function Section({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.section}>
      {title ? <h3 className={styles.sectionTitle}>{title}</h3> : null}
      {children}
    </div>
  );
}

export function KeyValues({ items }: { items: { k: ReactNode; v: ReactNode }[] }) {
  return (
    <dl className={styles.kv}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "contents" }}>
          <dt>{it.k}</dt>
          <dd>{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

const icons = {
  neutral: Info,
  info: Info,
  held: Clock,
  pass: CheckCircle2,
  fail: AlertCircle,
};

export function Note({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "info" | "held" | "pass" | "fail";
  children: ReactNode;
}) {
  const Icon = icons[tone];
  return (
    <div
      className={[styles.note, tone !== "neutral" && styles[`note-${tone}`]]
        .filter(Boolean)
        .join(" ")}
      role="note"
    >
      <Icon aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
