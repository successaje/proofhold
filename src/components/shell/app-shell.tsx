"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutList, Plus, Settings } from "lucide-react";
import type { ReactNode } from "react";
import type { SystemInfo } from "@/lib/view";
import { formatMoney } from "@/lib/format";
import { Brand } from "./brand";
import { ModeBadges } from "./mode-badges";
import styles from "./shell.module.css";

const links = [
  {
    href: "/app",
    label: "Proofholds",
    icon: LayoutList,
    exact: true,
    count: "attention" as const,
  },
  { href: "/app/new", label: "New proofhold", icon: Plus, exact: false },
  {
    href: "/app/settings#outbox",
    label: "Outbox",
    icon: Inbox,
    exact: false,
    count: "mail" as const,
  },
  { href: "/app/settings", label: "Settings", icon: Settings, exact: false },
];

export interface ShellCounts {
  attention: number;
  active: number;
  closed: number;
  /** Messages composed in the last day. */
  mail: number;
  heldCents: number;
  holds: number;
}

/**
 * The seller's shell. On desktop a left sidebar carries the workspace, the
 * navigation with live counts, and the modes in force; on phones a slim top
 * bar and a bottom bar do the same job.
 */
export function AppShell({
  workspace,
  system,
  counts,
  children,
}: {
  workspace: { name: string; email: string };
  system: SystemInfo;
  counts: ShellCounts;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = (href: string, exact: boolean) => {
    const clean = href.split("#")[0]!;
    if (href.includes("#")) return false;
    return (
      (exact ? pathname === clean : pathname.startsWith(clean)) ||
      (clean === "/app" && pathname.startsWith("/app/h/"))
    );
  };
  const initials = workspace.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const countFor = (key?: "attention" | "mail") =>
    key === "attention" ? counts.attention : key === "mail" ? counts.mail : 0;
  return (
    <div className={styles.frame}>
      <a href="#main" className="skipLink">
        Skip to content
      </a>
      <aside className={styles.sidebar} aria-label="Workspace">
        <div className={styles.sidebarTop}>
          <Brand href="/app" />
        </div>
        <Link
          href="/app/settings"
          className={styles.workspaceCard}
          title={workspace.email}
        >
          <span className={styles.avatar} aria-hidden="true">
            {initials || "W"}
          </span>
          <span className={styles.workspaceText}>
            <span className={styles.workspaceName}>{workspace.name}</span>
            <span className={styles.workspaceEmail}>{workspace.email}</span>
          </span>
        </Link>
        <nav className={styles.sideNav} aria-label="Primary">
          {links.map((l) => {
            const n = countFor(l.count);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={styles.sideLink}
                aria-current={current(l.href, l.exact) ? "page" : undefined}
              >
                <l.icon aria-hidden="true" />
                <span>{l.label}</span>
                {n > 0 ? (
                  <span
                    className={
                      l.count === "attention"
                        ? styles.count
                        : `${styles.count} ${styles.countQuiet}`
                    }
                    aria-label={`${n} ${l.count === "attention" ? "needing attention" : "messages today"}`}
                  >
                    {n}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className={styles.sideSummary}>
          <span className={styles.sideSummaryTitle}>Held by PayPal</span>
          <span className={styles.sideHeld}>{formatMoney(counts.heldCents, "USD")}</span>
          <span className={styles.sideHeldSub}>
            {counts.holds === 0
              ? "No open holds"
              : `across ${counts.holds} hold${counts.holds === 1 ? "" : "s"}`}
          </span>
          <nav className={styles.sideBuckets} aria-label="Groups">
            {(
              [
                ["attention", "Needs attention", counts.attention],
                ["active", "Active", counts.active],
                ["closed", "Closed", counts.closed],
              ] as const
            ).map(([bucket, label, n]) => (
              <Link
                key={bucket}
                href={`/app?bucket=${bucket}`}
                className={styles.sideBucket}
              >
                {label}
                <span>{n}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className={styles.sideModes}>
          <span className={styles.sideModesTitle}>This deployment</span>
          <ModeBadges system={system} />
        </div>
      </aside>

      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Brand href="/app" />
          <div className={styles.right}>
            <div className={styles.badgeCompact}>
              <ModeBadges system={system} compact />
            </div>
            <Link
              href="/app/settings"
              className={styles.workspace}
              title={workspace.email}
            >
              <span className={styles.avatar} aria-hidden="true">
                {initials || "W"}
              </span>
              <span className={styles.workspaceName}>{workspace.name}</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>

      <nav className={styles.bottomNav} aria-label="Primary">
        {links
          .filter((l) => !l.href.includes("#"))
          .map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={styles.bottomLink}
              aria-current={current(l.href, l.exact) ? "page" : undefined}
            >
              <l.icon aria-hidden="true" />
              {l.label === "New proofhold" ? "New" : l.label}
              {l.count === "attention" && counts.attention > 0 ? (
                <span className={styles.bottomCount} aria-hidden="true">
                  {counts.attention}
                </span>
              ) : null}
            </Link>
          ))}
      </nav>
    </div>
  );
}
