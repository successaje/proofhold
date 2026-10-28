import Link from "next/link";
import styles from "./shell.module.css";

export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={styles.mark}
    >
      <rect width="64" height="64" rx="14" fill="var(--brand)" />
      <path d="M20 34h10v10H20zM34 20h10v10H34z" fill="var(--brand-ink)" opacity=".5" />
      <path d="M20 20h10v10H20zM34 34h10v10H34z" fill="var(--brand-ink)" />
    </svg>
  );
}

export function Brand({ href = "/", size = 24 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className={styles.brand} aria-label="Proofhold home">
      <Mark size={size} />
      <span className={styles.wordmark}>Proofhold</span>
    </Link>
  );
}
