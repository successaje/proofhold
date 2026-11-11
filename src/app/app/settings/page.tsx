import type { Metadata } from "next";
import { PageHeader, Narrow } from "@/components/shell/page-header";
import { KeyValues, Note, Panel } from "@/components/ui/panel";
import { Mono } from "@/components/ui/status";
import { currentWorkspace } from "@/lib/session/workspace";
import { systemInfo } from "@/lib/view";
import { config } from "@/lib/config";
import { SettingsForm } from "./settings-form";
import { Outbox } from "./outbox";
import { db } from "@/lib/store/sql";
import { listMail } from "@/lib/store/repos";
import { DangerZone } from "./danger-zone";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ws = (await currentWorkspace())!;
  const system = systemInfo();
  const c = config();
  const mail = await listMail(await db(), { workspaceId: ws.id }, 50);
  return (
    <Narrow>
      <PageHeader
        title="Settings"
        lead="Your workspace, and what this deployment is connected to."
      />
      <div style={{ display: "grid", gap: "var(--s-5)" }}>
        <Panel title="Workspace" subtitle="Shown on the links you send.">
          <SettingsForm workspace={ws} />
        </Panel>
        <Panel
          title="Connections"
          subtitle="Set by environment variables; see .env.example."
        >
          <KeyValues
            items={[
              {
                k: "PayPal",
                v:
                  system.paypalMode === "sandbox"
                    ? "Sandbox (api-m.sandbox.paypal.com). Orders, authorizations, captures, tracking and disputes are real sandbox objects."
                    : "Simulated. No credentials configured; an in-process simulator applies PayPal's state rules. Set PAYPAL_MODE=sandbox with a client id and secret to use the sandbox.",
              },
              {
                k: "Webhooks",
                v: c.PAYPAL_WEBHOOK_ID ? (
                  <>
                    Verified against webhook <Mono>{c.PAYPAL_WEBHOOK_ID}</Mono>
                  </>
                ) : (
                  "Not registered. Reconciliation polling keeps holds in step with PayPal without them."
                ),
              },
              {
                k: "Examiner",
                v:
                  system.examinerMode === "model" ? (
                    <>
                      On, using <Mono>{system.model}</Mono>. Judgement lines are scored
                      with abstention allowed.
                    </>
                  ) : system.examinerMode === "simulated" ? (
                    "Simulated (EXAMINER_MODE=simulated). A deterministic stand-in judges judgement lines from file names, readable text and image metadata, labelled as simulated on every verdict. Set ANTHROPIC_API_KEY or GEMINI_API_KEY and EXAMINER_MODE=auto for the real examiner."
                  ) : (
                    "Off. Neither ANTHROPIC_API_KEY nor GEMINI_API_KEY is set, so briefs get a starter test and judgement lines fall to the buyer. Set EXAMINER_MODE=simulated to run the judgement path with a labelled stand-in."
                  ),
              },
              {
                k: "Mail",
                v:
                  system.mailMode === "resend"
                    ? "Resend. Buyers and you are emailed at every state change; the outbox below shows each result."
                    : "Simulated. Notifications are composed and kept in the outbox below; nothing is sent. Set MAIL_PROVIDER=resend and RESEND_API_KEY to send.",
              },
              {
                k: "Scheduler",
                v:
                  c.PROOFHOLD_SCHEDULER === "inline"
                    ? "Inline, every 30 seconds: examinations, buyer windows, reauthorization, expiry, reconciliation."
                    : c.PROOFHOLD_SCHEDULER === "external"
                      ? "External: call /api/internal/tick from cron."
                      : "Off.",
              },
              {
                k: "Storage",
                v: c.PROOFHOLD_STORE === "postgres" ? "Postgres" : "SQLite under .data/",
              },
              {
                k: "Buyer window",
                v: system.demoSilenceMinutes
                  ? `Shortened to ${system.demoSilenceMinutes} minutes for demos (DEMO_SILENCE_MINUTES).`
                  : "As agreed in each test (hours).",
              },
            ]}
          />
        </Panel>
        <Outbox mail={mail} mode={system.mailMode} />
        <DangerZone workspaceName={ws.name} />
        <Note tone="info">
          Where the money goes today: every capture lands in the PayPal business account
          this deployment runs with, whatever email is saved above. Production would add a
          real sign-in (Login with PayPal or email links) and a payout check that the
          workspace email matches the account that receives captures. Both are out of
          scope for this release and documented as such.
        </Note>
      </div>
    </Narrow>
  );
}
