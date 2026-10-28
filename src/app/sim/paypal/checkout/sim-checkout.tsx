"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Note } from "@/components/ui/panel";
import { api } from "@/lib/client";
import styles from "./sim.module.css";

export function SimCheckout(props: {
  orderId: string;
  amount: string;
  merchant: string;
  description: string;
  customId: string;
  approved: boolean;
  cancelUrl: string;
  defaultEmail: string;
  defaultName: string;
}) {
  const [email, setEmail] = useState(props.defaultEmail || "buyer@personal.example.com");
  const [name, setName] = useState(props.defaultName || "Sandbox Buyer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ returnUrl: string }>("/api/sim/paypal/approve", {
        body: { orderId: props.orderId, email, name },
      });
      window.location.assign(r.returnUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve.");
      setBusy(false);
    }
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.banner}>
          Simulated PayPal · not PayPal · no credentials configured
        </div>
        <h1 className={styles.title}>Authorize a payment</h1>
        <p className={styles.lead}>
          <strong>{props.merchant}</strong> asks you to authorize{" "}
          <strong>{props.amount}</strong> for “{props.description}”. The amount is
          reserved, not charged. It can only be captured against the test whose hash is
          attached to this order.
        </p>
        <dl className={styles.facts}>
          <dt>Order</dt>
          <dd>{props.orderId}</dd>
          <dt>custom_id</dt>
          <dd>{props.customId.slice(0, 24)}…</dd>
        </dl>
        {props.approved ? (
          <Note tone="info">This order was already approved.</Note>
        ) : (
          <form onSubmit={approve} className={styles.form}>
            <Field label="PayPal account email" htmlFor="sim-email">
              <Input
                id="sim-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Name on the account" htmlFor="sim-name">
              <Input
                id="sim-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            {error ? <Note tone="fail">{error}</Note> : null}
            <Button type="submit" size="lg" block loading={busy}>
              Authorize {props.amount}
            </Button>
            <Button
              href={`/api/paypal/cancel?token=${encodeURIComponent(props.orderId)}`}
              variant="ghost"
              block
            >
              Cancel and return
            </Button>
          </form>
        )}
        <p className={styles.fine}>
          In sandbox mode this page is PayPal's own checkout. Here, the simulator applies
          the same rules: approval, a 29-day authorization with a 3-day honor period,
          partial and final capture, void.
        </p>
      </div>
    </main>
  );
}
