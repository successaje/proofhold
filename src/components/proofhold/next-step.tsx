import Link from "next/link";
import { Note } from "@/components/ui/panel";
import type { ProofholdView } from "@/lib/view";

const copy: Partial<Record<ProofholdView["status"], { lead: string; body: string }>> = {
  expired: {
    lead: "Nothing was charged.",
    body: "The PayPal authorization lapsed before a decision, so the reservation was released on its own. If the work is still on, send the buyer a fresh link:",
  },
  voided: {
    lead: "The hold went back to the buyer.",
    body: "No money moved. If you agree new terms, the test is editable before you send it again:",
  },
  cancelled: {
    lead: "Cancelled before any money was held.",
    body: "The buyer link no longer works. To send it again:",
  },
};

/** What a seller can do once a proofhold has closed without a release. */
export function NextStep({ ph }: { ph: ProofholdView }) {
  const c = copy[ph.status];
  if (!c) return null;
  return (
    <Note tone="info">
      <strong>{c.lead}</strong> {c.body}{" "}
      <Link href={`/app/new?from=${encodeURIComponent(ph.id)}`}>
        start another from this test
      </Link>
      .
    </Note>
  );
}
