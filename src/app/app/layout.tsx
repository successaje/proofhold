import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { currentWorkspace } from "@/lib/session/workspace";
import { systemInfo } from "@/lib/view";
import { db } from "@/lib/store/sql";
import { listMail, listProofholds } from "@/lib/store/repos";
import { bucketOf } from "@/lib/domain/ledger";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ws = await currentWorkspace();
  const path = (await headers()).get("x-pathname");
  if (!ws) {
    if (path === "/app/start") return <ToastProvider>{children}</ToastProvider>;
    redirect("/app/start");
  }
  const sql = await db();
  const [items, mail] = await Promise.all([
    listProofholds(sql, ws.id),
    listMail(sql, { workspaceId: ws.id }, 200),
  ]);
  const dayAgo = Date.now() - 24 * 3_600_000;
  const heldItems = items.filter((p) =>
    ["held", "checking", "awaiting_buyer", "in_review", "disputed"].includes(p.status),
  );
  const counts = {
    attention: items.filter((p) => bucketOf(p.status) === "attention").length,
    active: items.filter((p) => bucketOf(p.status) === "active").length,
    closed: items.filter((p) => bucketOf(p.status) === "closed").length,
    mail: mail.filter((m) => Date.parse(m.createdAt) > dayAgo).length,
    heldCents: heldItems.reduce((s, p) => s + p.amountCents - p.releasedCents, 0),
    holds: heldItems.length,
  };
  return (
    <ToastProvider>
      <AppShell workspace={ws} system={systemInfo()} counts={counts}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
