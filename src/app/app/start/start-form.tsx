"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Note } from "@/components/ui/panel";
import styles from "./start.module.css";

export function StartForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create your workspace.");
      router.push("/app/new");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your workspace.");
      setPending(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <Brand size={28} />
        <h1 className={styles.title}>Set up your workspace</h1>
        <p className={styles.lead}>
          Your name appears on the links you send. Your PayPal email is where captured
          payments land: it must match the business account whose credentials this app
          runs with.
        </p>
        <form onSubmit={submit} className={styles.form}>
          <Field label="Your name" htmlFor="name">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              maxLength={80}
              autoFocus
            />
          </Field>
          <Field
            label="PayPal email"
            htmlFor="email"
            hint="Sandbox business account email while testing."
          >
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              maxLength={200}
            />
          </Field>
          {error ? <Note tone="fail">{error}</Note> : null}
          <Button type="submit" size="lg" loading={pending} block>
            Continue
          </Button>
        </form>
        <p className={styles.fine}>
          No password. This browser is remembered with a signed cookie; clear it from
          Settings.
        </p>
      </div>
    </div>
  );
}
