import type { Mailer, MailMessage, MailResult } from "./types";

/**
 * No provider configured: nothing leaves the process. The outbox row that the
 * caller records is the whole delivery, and Settings shows it.
 */
export class SimulatedMailer implements Mailer {
  readonly provider = "simulated" as const;
  async send(_message: MailMessage): Promise<MailResult> {
    return { status: "simulated", providerId: null, error: null };
  }
}
