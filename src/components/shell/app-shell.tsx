"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutList, Plus, Settings } from "lucide-react";
import type { ReactNode } from "react";
import type { SystemInfo } from "@/lib/view";
import { Brand } from "./brand";
import { ModeBadges } from "./mode-badges";
import styles from "./shell.module.css";

const links = [
  { href: "/app", label: "Proofholds", icon: LayoutList, exact: true },
  { href: "/app/new", label: "New", icon: Plus, exact: false },
  { href: "/app/settings", label: "Settings", icon: Settings, exact: false },
];

export function AppShell({
  workspace,
  system,
  children,
}: {
  workspace: { name: string; email: string };
  system: SystemInfo;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = (href: string, exact: boolean) =>
    (exact ? pathname === href : pathname.startsWith(href)) ||
    (href === "/app" && pathname.startsWith("/app/h/"));
  const initials = workspace.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Brand href="/app" />
          <nav className={styles.nav} aria-label="Primary">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={styles.navLink}
                aria-current={current(l.href, l.exact) ? "page" : undefined}
              >
                <l.icon aria-hidden="true" />
                {l.label === "New" ? "New proofhold" : l.label}
              </Link>
            ))}
          </nav>
          <div className={styles.right}>
            <div className={styles.badges}>
              <ModeBadges system={system} />
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
      <main className={styles.main}>{children}</main>
      <nav className={styles.bottomNav} aria-label="Primary">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={styles.bottomLink}
            aria-current={current(l.href, l.exact) ? "page" : undefined}
          >
            <l.icon aria-hidden="true" />
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
