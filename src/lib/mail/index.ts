import { config } from "../config";
import { ResendMailer } from "./resend";
import { SimulatedMailer } from "./simulated";
import type { Mailer } from "./types";

let instance: Mailer | undefined;

/** The process-wide mailer, chosen by configuration. */
export function mailer(): Mailer {
  if (instance) return instance;
  const c = config();
  instance =
    c.mail.provider === "resend"
      ? new ResendMailer(c.RESEND_API_KEY!, c.MAIL_FROM)
      : new SimulatedMailer();
  return instance;
}

/** Test hook. */
export function __setMailer(m: Mailer | undefined) {
  instance = m;
}

export type { Mailer, MailMessage, MailResult } from "./types";
