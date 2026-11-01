import type { Mailer, MailMessage, MailResult } from "./types";

/**
 * Resend's send endpoint (https://resend.com/docs/api-reference/emails/send-email).
 * Contract as documented on 2026-11-01; not yet exercised against a live key,
 * so docs/integration-checklist.md lists it as unverified.
 */
export class ResendMailer implements Mailer {
  readonly provider = "resend" as const;
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: MailMessage): Promise<MailResult> {
    try {
      const res = await this.fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (!res.ok)
        return {
          status: "failed",
          providerId: null,
          error: body.message ?? `HTTP ${res.status}`,
        };
      return { status: "sent", providerId: body.id ?? null, error: null };
    } catch (error) {
      return {
        status: "failed",
        providerId: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
