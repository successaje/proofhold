export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailResult {
  status: "simulated" | "sent" | "failed";
  providerId: string | null;
  error: string | null;
}

export interface Mailer {
  readonly provider: "simulated" | "resend";
  send(message: MailMessage): Promise<MailResult>;
}
