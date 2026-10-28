"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormRow, Input, Select, Textarea } from "@/components/ui/field";
import { Note } from "@/components/ui/panel";
import { Stages } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import type { Decision } from "@/lib/domain/proofhold";
import { formatMoney } from "@/lib/format";
import type { ProofholdView, SystemInfo } from "@/lib/view";
import styles from "./buyer.module.css";

export function ApproveForm({
  token,
  ph,
  system,
}: {
  token: string;
  ph: ProofholdView;
  system: SystemInfo;
}) {
  const [name, setName] = useState(ph.buyerName ?? "");
  const [email, setEmail] = useState(ph.buyerEmail ?? "");
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStage(1);
    try {
      const result = await api<{ approveUrl: string }>(`/api/p/${token}/approve`, {
        body: { name, email },
      });
      setStage(2);
      window.location.assign(result.approveUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start PayPal.");
      setStage(0);
    }
  }

  if (stage > 0)
    return (
      <div className={styles.approving}>
        <Stages
          stages={[
            {
              label: "Creating the PayPal order with the test hash attached",
              state: stage === 1 ? "active" : "done",
            },
            {
              label:
                system.paypalMode === "sandbox"
                  ? "Sending you to PayPal to approve the hold"
                  : "Sending you to the simulated PayPal approval",
              state: stage === 2 ? "active" : "todo",
            },
            { label: "Back here with the authorization", state: "todo" },
          ]}
        />
      </div>
    );

  return (
    <form onSubmit={submit} className={styles.approve}>
      <FormRow>
        <Field label="Your name" htmlFor="b-name">
          <Input
            id="b-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            autoComplete="name"
          />
        </Field>
        <Field label="Email for updates" htmlFor="b-email">
          <Input
            id="b-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={200}
            autoComplete="email"
          />
        </Field>
      </FormRow>
      {error ? <Note tone="fail">{error}</Note> : null}
      <Button type="submit" size="lg" block icon={<CheckCircle2 />}>
        Approve {ph.amount} with PayPal
      </Button>
      <p className={styles.fine}>
        {system.paypalMode === "sandbox"
          ? "You will log in to PayPal (sandbox) and approve an authorization, not a payment. Nothing is captured today."
          : "Simulated PayPal: a stand-in approval page, because this deployment has no PayPal credentials. The state rules are the same."}
      </p>
    </form>
  );
}

export function BuyerResponse({ token, ph }: { token: string; ph: ProofholdView }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"confirm" | "object" | null>(null);
  const [open, setOpen] = useState<"confirm" | "object" | null>(null);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const held = ph.status === "held";

  async function act(kind: "confirm" | "object") {
    setBusy(kind);
    try {
      await api(`/api/p/${token}/${kind}`, {
        body: kind === "confirm" ? { message } : { reason },
      });
      toast(
        kind === "confirm"
          ? "Confirmed. PayPal is capturing the payment."
          : "Objection recorded. The seller has been told.",
        kind === "confirm" ? "pass" : "info",
      );
      setOpen(null);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "That did not work.", "fail");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className={styles.decide}>
        <Button size="lg" onClick={() => setOpen("confirm")} icon={<CheckCircle2 />}>
          {held ? "Release without waiting" : "Confirm and release"}
        </Button>
        {!held ? (
          <Button
            size="lg"
            variant="secondary"
            onClick={() => setOpen("object")}
            icon={<AlertTriangle />}
          >
            Object
          </Button>
        ) : null}
      </div>
      <Dialog
        open={open === "confirm"}
        onClose={() => setOpen(null)}
        title={`Release ${formatMoney(ph.amountCents - ph.releasedCents, ph.currency)} to the seller?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Not yet
            </Button>
            <Button loading={busy === "confirm"} onClick={() => act("confirm")}>
              Release now
            </Button>
          </>
        }
      >
        <p>
          PayPal captures the authorization immediately. This is the end of the hold; if
          something is wrong later, PayPal's own dispute process applies.
        </p>
        <Field label="Message to the seller" htmlFor="confirm-msg" optional>
          <Textarea
            id="confirm-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
      </Dialog>
      <Dialog
        open={open === "object"}
        onClose={() => setOpen(null)}
        title="What is wrong?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === "object"}
              disabled={reason.trim().length < 5}
              onClick={() => act("object")}
            >
              Send objection
            </Button>
          </>
        }
      >
        <p>
          Nothing is captured while you object. The seller can offer a partial release,
          fix the delivery and resubmit, or return the hold.
        </p>
        <Field
          label="Reason"
          htmlFor="object-reason"
          hint="Be specific; it is shown to the seller and kept in the record."
        >
          <Textarea
            id="object-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={1000}
            autoFocus
          />
        </Field>
      </Dialog>
    </>
  );
}

export function OfferResponse({ token, ph }: { token: string; ph: ProofholdView }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const offer = ph.offerCents ?? 0;
  const rest = ph.amountCents - ph.releasedCents - offer;

  async function act(kind: "accept" | "decline") {
    setBusy(kind);
    try {
      await api(`/api/p/${token}/offer/${kind}`, {
        body: kind === "decline" ? { reason } : {},
      });
      toast(
        kind === "accept"
          ? `Accepted. PayPal captures ${formatMoney(offer, ph.currency)} and returns the rest.`
          : "Declined. The hold is being returned to you.",
        kind === "accept" ? "pass" : "info",
      );
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "That did not work.", "fail");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.stack}>
      <p className={styles.offer}>
        Release <strong>{formatMoney(offer, ph.currency)}</strong> and return{" "}
        <strong>{formatMoney(rest, ph.currency)}</strong> to you.
      </p>
      {ph.offerNote ? (
        <blockquote className={styles.quote}>“{ph.offerNote}”</blockquote>
      ) : null}
      {declining ? (
        <Field label="Why you are declining" htmlFor="decline-reason" optional>
          <Textarea
            id="decline-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
      ) : null}
      <div className={styles.decide}>
        <Button size="lg" loading={busy === "accept"} onClick={() => act("accept")}>
          Accept the offer
        </Button>
        {declining ? (
          <Button
            size="lg"
            variant="danger"
            loading={busy === "decline"}
            onClick={() => act("decline")}
          >
            Decline and take the hold back
          </Button>
        ) : (
          <Button size="lg" variant="secondary" onClick={() => setDeclining(true)}>
            Decline
          </Button>
        )}
      </div>
      <p className={styles.fine}>
        Declining voids the whole authorization: nothing is paid and the proofhold closes.
      </p>
    </div>
  );
}

export function DisputeDemo({
  token,
  ph,
  system,
  decisions,
}: {
  token: string;
  ph: ProofholdView;
  system: SystemInfo;
  decisions: Decision[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<
    "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" | "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"
  >("MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED");
  const [txn, setTxn] = useState("");
  const capture = decisions.filter((d) => d.paypalCaptureId).pop();

  async function submit() {
    setBusy(true);
    try {
      await api(`/api/p/${token}/dispute/open`, {
        body: { reason, buyerTransactionId: txn || null },
      });
      toast("Dispute opened with PayPal.", "info");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not open the dispute.", "fail");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.disputeBox}>
      <div>
        <p className={styles.disputeTitle}>Something wrong after release?</p>
        <p className={styles.fine}>
          Once captured, PayPal's dispute process applies. Proofhold files the full
          evidence record on the seller's behalf.
          {system.paypalMode === "sandbox"
            ? " In the sandbox, disputes are opened through PayPal's sandbox-only endpoint."
            : " Simulated here."}
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        icon={<ShieldAlert />}
        onClick={() => setOpen(true)}
      >
        Open a PayPal dispute
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Open a dispute with PayPal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={submit}>
              Open dispute
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor="dispute-reason">
          <Select
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
          >
            <option value="MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED">
              Not as described
            </option>
            <option value="MERCHANDISE_OR_SERVICE_NOT_RECEIVED">Not received</option>
          </Select>
        </Field>
        {system.paypalMode === "sandbox" ? (
          <Field
            label="Your PayPal transaction id"
            htmlFor="txn"
            hint={`The buyer-side transaction id from your sandbox PayPal activity. Leave empty to try the capture id ${capture?.paypalCaptureId ?? ""}.`}
          >
            <Input id="txn" value={txn} onChange={(e) => setTxn(e.target.value)} />
          </Field>
        ) : null}
        <p className={styles.fine}>
          This is the real PayPal path, demonstrated in the sandbox. The seller sees the
          dispute and files the evidence bundle; the outcome comes back here.
        </p>
      </Dialog>
    </div>
  );
}
