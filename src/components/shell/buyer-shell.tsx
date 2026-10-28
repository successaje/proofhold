import type { ReactNode } from "react";
import { Brand } from "./brand";
import { ModeBadges } from "./mode-badges";
import type { SystemInfo } from "@/lib/view";
import styles from "./shell.module.css";

export function BuyerShell({
  system,
  children,
}: {
  system: SystemInfo;
  children: ReactNode;
}) {
  return (
    <>
      <header className={styles.buyerBar}>
        <div className={styles.buyerBarInner}>
          <Brand />
          <div style={{ display: "flex", gap: "var(--s-2)" }}>
            <ModeBadges system={system} />
          </div>
        </div>
      </header>
      <main className={styles.buyerMain}>{children}</main>
      <footer className={styles.buyerFoot}>
        Proofhold never holds your money. Approval creates a PayPal authorization that
        only PayPal can capture or release, and only under the test shown on this page.
      </footer>
    </>
  );
}
