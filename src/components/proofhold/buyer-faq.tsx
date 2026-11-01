import type { ProofholdView } from "@/lib/view";
import styles from "./buyer-faq.module.css";

/** The questions a buyer asks before approving, answered with this proofhold's own numbers. */
export function BuyerFaq({
  ph,
  sellerName,
  stage,
}: {
  ph: ProofholdView;
  sellerName: string;
  stage: "before" | "during";
}) {
  const hours = ph.test.rules.silence_window_hours;
  const items: { q: string; a: string }[] = [
    {
      q: "What happens if I do nothing?",
      a:
        stage === "before"
          ? "Nothing. No hold is created until you approve, and the link simply sits there."
          : `If every required line passed, PayPal releases ${ph.amount} to ${sellerName} when the ${hours}-hour window closes. If a line failed or the examiner was unsure, nothing moves until you confirm or object: there is no deadline in that case.`,
    },
    {
      q: `What if ${sellerName} never delivers?`,
      a: "The hold expires on its own 29 days after approval and the reservation is released. You can also end it earlier from this page; nothing is charged either way.",
    },
    {
      q: "What if the delivery is wrong?",
      a: `Object within the window with a reason. Nothing is captured while you object. ${sellerName} can offer a partial release, fix and resubmit, or return the whole hold. If you decline an offer, the hold is returned in full.`,
    },
    {
      q: "What if I change my mind after releasing?",
      a: "Once PayPal captures, the money is paid. From then on PayPal's own dispute process applies, and the record on this page is filed with it as evidence.",
    },
    {
      q: "Are there fees?",
      a: `No fee is added to the ${ph.amount} you approve. Standard PayPal fees are the seller's, charged on capture; nothing is charged on a void.`,
    },
    {
      q: "Who can see this page?",
      a: "Anyone with this link. It is unguessable, so keep it to yourself; there is no account to sign in to.",
    },
  ];
  return (
    <section className={styles.faq} aria-label="What happens if">
      <h3 className={styles.title}>What happens if…</h3>
      <ul className={styles.list}>
        {items.map((it) => (
          <li key={it.q}>
            <details className={styles.item}>
              <summary className={styles.q}>{it.q}</summary>
              <p className={styles.a}>{it.a}</p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
