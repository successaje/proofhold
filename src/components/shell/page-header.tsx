import type { ReactNode } from "react";
import styles from "./shell.module.css";

export function PageHeader({
  title,
  lead,
  actions,
  eyebrow,
  below,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  /** A full-width row under the title and actions, for the rail. */
  below?: ReactNode;
}) {
  return (
    <div className={styles.pageHeader}>
      <div>
        {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
        <h1 className={styles.pageTitle}>{title}</h1>
        {lead ? <div className={styles.pageLead}>{lead}</div> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
      {below ? <div className={styles.pageBelow}>{below}</div> : null}
    </div>
  );
}

export function Narrow({ children }: { children: ReactNode }) {
  return <div className={styles.narrow}>{children}</div>;
}
