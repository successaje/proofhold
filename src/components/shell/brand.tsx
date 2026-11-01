import Link from "next/link";
import styles from "./shell.module.css";

/**
 * The mark: a ring (the hold) and a tick whose tail leaves the ring through a
 * gap (the release that ends it). Strokes take currentColor so it works on
 * paper, on the brand colour and in dark mode.
 */
export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={[styles.mark, className].filter(Boolean).join(" ")}
    >
      <path
        d="M52.8 20A24 24 0 1 1 44 11.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M21 33l8 8 26-28"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand({ href = "/", size = 22 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className={styles.brand} aria-label="Proofhold home">
      <Mark size={size} />
      <span className={styles.wordmark}>Proofhold</span>
    </Link>
  );
}
