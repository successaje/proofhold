import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { currentWorkspace } from "@/lib/session/workspace";
import { systemInfo } from "@/lib/view";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ws = await currentWorkspace();
  const path = (await headers()).get("x-pathname");
  if (!ws) {
    if (path === "/app/start") return <ToastProvider>{children}</ToastProvider>;
    redirect("/app/start");
  }
  return (
    <ToastProvider>
      <AppShell workspace={ws} system={systemInfo()}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
