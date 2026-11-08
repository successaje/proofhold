import { Mail } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";
import type { MailRecord } from "@/lib/store/repos";
import styles from "./outbox.module.css";

/**
 * Every notification the workspace has produced. In simulated mode this is the
 * delivery; with a provider it is the log of what was sent and what failed.
 */
export function Outbox({
  mail,
  mode,
}: {
  mail: MailRecord[];
  mode: "simulated" | "resend";
}) {
  return (
    <Panel
      id="outbox"
      title="Outbox"
      subtitle={
        mode === "simulated"
          ? "Mail is simulated in this deployment: nothing is sent, and this list is the delivery. Set MAIL_PROVIDER=resend with a key to send for real."
          : "Everything sent through Resend, with its result."
      }
      actions={
        <Badge icon={<Mail />}>
          {mode === "simulated" ? "Mail simulated" : "Resend"}
        </Badge>
      }
    >
      {mail.length === 0 ? (
        <EmptyState title="No mail yet">
          The buyer is written to when you send a link, when a delivery is ready for them,
          and when money moves. You are written to when they approve, object, or dispute.
        </EmptyState>
      ) : (
        <ul className={styles.list}>
          {mail.map((m) => (
            <li key={m.id}>
              <details className={styles.item}>
                <summary className={styles.summary}>
                  <span className={styles.subject}>{m.subject}</span>
                  <span className={styles.meta}>
                    to {m.toRole} · {m.to} · {formatDate(m.createdAt)} ·{" "}
                    <span
                      className={[styles.status, styles[`status-${m.status}`]].join(" ")}
                    >
                      {m.status === "simulated" ? "kept here" : m.status}
                    </span>
                  </span>
                </summary>
                <pre className={styles.body}>{m.text}</pre>
                {m.error ? (
                  <p className={styles.error}>Provider error: {m.error}</p>
                ) : null}
              </details>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
