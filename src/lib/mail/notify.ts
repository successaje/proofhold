/**
 * Notifications at every state change. Never blocks the change that caused it:
 * a failed send is recorded in the outbox with its error and the state stands.
 */
import { config } from "../config";
import type { Proofhold } from "../domain/proofhold";
import { describeError, log } from "../log";
import { getWorkspace, recordMail, type MailRecord } from "../store/repos";
import type { Sql } from "../store/sql";
import { mailer } from "./index";
import { template, type MailEvent } from "./templates";

const audiences: Record<MailEvent, ("seller" | "buyer")[]> = {
  proposed: ["buyer"],
  approved: ["seller"],
  window_open: ["buyer"],
  window_blocked: ["buyer"],
  review: ["seller"],
  offer: ["buyer"],
  released: ["seller", "buyer"],
  partially_released: ["seller", "buyer"],
  voided: ["seller", "buyer"],
  expired: ["seller", "buyer"],
  disputed: ["seller"],
  dispute_resolved: ["seller", "buyer"],
  reminder_window: ["buyer"],
  reminder_expiry: ["seller"],
};

export async function notify(
  sql: Sql,
  ph: Proofhold,
  event: MailEvent,
  extra?: Record<string, string | number | null | undefined>,
): Promise<MailRecord[]> {
  const out: MailRecord[] = [];
  try {
    const c = config();
    const ws = await getWorkspace(sql, ph.workspaceId);
    const buyerUrl = `${c.APP_URL}/p/${ph.buyerToken}`;
    const input = {
      ph,
      sellerName: ws?.name ?? "The seller",
      buyerUrl,
      sellerUrl: `${c.APP_URL}/app/h/${ph.id}`,
      recordUrl: `${c.APP_URL}/app/h/${ph.id}/record`,
      extra,
    };
    for (const audience of audiences[event]) {
      const to = audience === "seller" ? ws?.email : (ph.buyerEmail ?? ph.payerEmail);
      if (!to) continue;
      const rendered = template(event, audience, input);
      if (!rendered) continue;
      const m = mailer();
      const result = await m.send({ to, ...rendered });
      out.push(
        await recordMail(sql, {
          workspaceId: ph.workspaceId,
          proofholdId: ph.id,
          to,
          toRole: audience,
          event,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          status: result.status,
          provider: m.provider,
          providerId: result.providerId,
          error: result.error,
          sentAt: result.status === "sent" ? new Date().toISOString() : null,
        }),
      );
      if (result.status === "failed")
        log("warn", "mail failed", { event, audience, error: result.error });
    }
  } catch (error) {
    log("error", "notify failed", { event, proofholdId: ph.id, ...describeError(error) });
  }
  return out;
}

/** The reminder a hold is due, if any: before the buyer window closes, or before the authorization lapses. */
export function reminderDue(
  ph: Proofhold,
  now: Date,
): { event: "reminder_window" | "reminder_expiry"; at: string } | null {
  if (ph.status === "awaiting_buyer" && ph.silenceWindowEndsAt) {
    const end = Date.parse(ph.silenceWindowEndsAt);
    const opened = ph.evidenceSubmittedAt ? Date.parse(ph.evidenceSubmittedAt) : end;
    const total = Math.max(end - opened, 1);
    const lead = Math.min(24 * 3_600_000, total / 2);
    if (end - now.getTime() <= lead && end > now.getTime())
      return { event: "reminder_window", at: ph.silenceWindowEndsAt };
  }
  if (ph.status === "held" && ph.authorizationExpiresAt) {
    const end = Date.parse(ph.authorizationExpiresAt);
    if (end - now.getTime() <= 3 * 86_400_000 && end > now.getTime())
      return { event: "reminder_expiry", at: ph.authorizationExpiresAt };
  }
  return null;
}
