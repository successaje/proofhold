"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./start-here.module.css";

/**
 * The landing's start form: kind and amount, nothing else. It only carries
 * the two values into the composer; nothing is created until the seller
 * writes the brief and sends it.
 */
export function StartHere() {
  const router = useRouter();
  const [kind, setKind] = useState<"service" | "goods">("service");
  const [amount, setAmount] = useState("420");
  function go(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ kind });
    if (/^\d{1,7}(\.\d{1,2})?$/.test(amount)) q.set("amount", amount);
    router.push(`/app/new?${q.toString()}`);
  }
  return (
    <form className={styles.form} onSubmit={go} aria-label="Start a proofhold">
      <span className={styles.lead}>I am selling</span>
      <div className={styles.segmented} role="radiogroup" aria-label="Kind of job">
        {(["service", "goods"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className={styles.segment}
            onClick={() => setKind(k)}
          >
            {k === "service" ? "a service" : "goods"}
          </button>
        ))}
      </div>
      <label className={styles.amount}>
        <span className={styles.for}>for</span>
        <span className={styles.currency} aria-hidden="true">
          $
        </span>
        <input
          aria-label="Amount in US dollars"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          className={styles.input}
          size={6}
        />
      </label>
      <Button type="submit" size="lg" icon={<ArrowRight />}>
        Write the brief
      </Button>
    </form>
  );
}
