"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Download, FileCheck2, Gavel, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, PrefixedInput, Textarea } from "@/components/ui/field";
import { Note } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import type { ProofholdView, SystemInfo } from "@/lib/view";
import styles from "./proofhold.module.css";

function useAction(id: string) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (name: string, path: string, body?: unknown, success?: string) => {
    setBusy(name);
    try {
      await api(`/api/proofholds/${id}${path}`, { body: body ?? {} });
      if (success) toast(success, "pass");
      router.refresh();
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : "That did not work.", "fail");
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

export function ProposeButton({ ph }: { ph: ProofholdView }) {
  const { busy, run } = useAction(ph.id);
  return (
    <Button
      onClick={() => run("propose", "/propose", undefined, "Sent. Share the buyer link.")}
      loading={busy === "propose"}
      icon={<Send />}
    >
      Send to the buyer
    </Button>
  );
}

export function CancelButton({ ph }: { ph: ProofholdView }) {
  const { busy, run } = useAction(ph.id);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} icon={<Ban />}>
        Cancel
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel this proofhold?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={busy === "cancel"}
              onClick={async () =>
                (await run("cancel", "/cancel", undefined, "Cancelled")) && setOpen(false)
              }
            >
              Cancel proofhold
            </Button>
          </>
        }
      >
        No money has been held. The buyer link stops working.
      </Dialog>
    </>
  );
}

export function EndHoldButton({ ph }: { ph: ProofholdView }) {
  const { busy, run } = useAction(ph.id);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const remaining = ph.amountCents - ph.releasedCents;
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} icon={<Ban />}>
        End the hold
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Return the money to the buyer?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep the hold
            </Button>
            <Button
              variant="danger"
              loading={busy === "end"}
              disabled={reason.trim().length < 3}
              onClick={async () =>
                (await run("end", "/end", { reason }, "Hold ended")) && setOpen(false)
              }
            >
              Void {formatMoney(remaining, ph.currency)}
            </Button>
          </>
        }
      >
        <p>
          PayPal voids the authorization. {formatMoney(remaining, ph.currency)} goes back
          to the buyer and this proofhold closes. This cannot be undone.
        </p>
        <Field label="Reason (shown to the buyer)" htmlFor="end-reason">
          <Textarea
            id="end-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
          />
        </Field>
      </Dialog>
    </>
  );
}

export function OfferForm({ ph }: { ph: ProofholdView }) {
  const { busy, run } = useAction(ph.id);
  const remaining = ph.amountCents - ph.releasedCents;
  const [amount, setAmount] = useState(String(Math.round(remaining / 2) / 100));
  const [note, setNote] = useState("");
  const cents = Math.round(Number(amount) * 100);
  const valid = Number.isInteger(cents) && cents > 0 && cents <= remaining;
  if (ph.offerCents) {
    return (
      <Note tone="held">
        You offered <strong>{formatMoney(ph.offerCents, ph.currency)}</strong>
        {ph.offerNote ? <> · “{ph.offerNote}”</> : null}. Waiting for the buyer to accept
        or decline. If they decline, the hold is returned.
      </Note>
    );
  }
  return (
    <div className={styles.stack}>
      <Field
        label="Propose a partial release"
        htmlFor="offer"
        hint={`Up to ${formatMoney(remaining, ph.currency)}. If the buyer accepts, PayPal captures this and returns the rest.`}
      >
        <PrefixedInput
          id="offer"
          prefix={ph.currency === "USD" ? "$" : ph.currency}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          aria-invalid={!valid}
        />
      </Field>
      <Field label="Why this amount" htmlFor="offer-note" optional>
        <Textarea
          id="offer-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={2000}
        />
      </Field>
      <div className={styles.actionsRow}>
        <Button
          onClick={() =>
            run(
              "offer",
              "/offer",
              { amountCents: cents, note },
              "Offer sent to the buyer",
            )
          }
          loading={busy === "offer"}
          disabled={!valid}
        >
          Send offer
        </Button>
      </div>
    </div>
  );
}

export function ReopenButton({ ph }: { ph: ProofholdView }) {
  const { busy, run } = useAction(ph.id);
  return (
    <Button
      variant="secondary"
      onClick={() =>
        run("reopen", "/reopen", undefined, "Reopened. Add evidence and resubmit.")
      }
      loading={busy === "reopen"}
      icon={<RotateCcw />}
    >
      Fix and resubmit
    </Button>
  );
}

export function BundleButton({ ph }: { ph: ProofholdView }) {
  return (
    <Button
      href={`/api/proofholds/${ph.id}/bundle`}
      variant="secondary"
      size="sm"
      icon={<Download />}
    >
      Evidence bundle
    </Button>
  );
}

export function DisputeActions({
  ph,
  system,
}: {
  ph: ProofholdView;
  system: SystemInfo;
}) {
  const { busy, run } = useAction(ph.id);
  return (
    <div className={styles.stack}>
      <p style={{ fontSize: "var(--text-md)", color: "var(--ink-2)" }}>
        PayPal decides now. Proofhold hands it the evidence bundle: the agreed test and
        its hash, every check with its reasons, the files with their fingerprints, and the
        full history.
      </p>
      <div className={styles.actionsRow}>
        <span className="lead">Dispute {ph.paypalDisputeId}</span>
        <Button
          onClick={() =>
            run("file", "/dispute/file", undefined, "Evidence filed with PayPal")
          }
          loading={busy === "file"}
          icon={<FileCheck2 />}
        >
          File evidence with PayPal
        </Button>
      </div>
      <Note tone="info">
        <strong>
          {system.paypalMode === "sandbox" ? "Sandbox only." : "Simulated."}
        </strong>{" "}
        PayPal's adjudication is simulated with the sandbox <code>adjudicate</code>{" "}
        endpoint so the whole path can be shown. In production, PayPal's own process
        decides.
      </Note>
      <div className={styles.actionsRow}>
        <Button
          variant="secondary"
          size="sm"
          icon={<Gavel />}
          loading={busy === "seller"}
          onClick={() =>
            run(
              "seller",
              "/dispute/adjudicate",
              { outcome: "SELLER_FAVOR" },
              "Resolved for the seller",
            )
          }
        >
          Simulate: seller wins
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Gavel />}
          loading={busy === "buyer"}
          onClick={() =>
            run(
              "buyer",
              "/dispute/adjudicate",
              { outcome: "BUYER_FAVOR" },
              "Resolved for the buyer",
            )
          }
        >
          Simulate: buyer wins
        </Button>
      </div>
    </div>
  );
}
