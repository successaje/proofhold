import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/shell/brand";
import styles from "./legal.module.css";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.page} id="main" tabIndex={-1}>
      <a href="#main" className="skipLink">
        Skip to content
      </a>
      <Brand />
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.updated}>Last updated {updated}</p>
      <div className={styles.body}>{children}</div>
      <nav className={styles.foot} aria-label="Legal">
        <Link href="/">Home</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
    </main>
  );
}
