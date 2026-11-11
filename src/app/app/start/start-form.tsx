"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/shell/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Note } from "@/components/ui/panel";
import { useHydrated } from "@/lib/use-hydrated";
import styles from "./start.module.css";

export function StartForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();

  const [touched, setTouched] = useState(false);
  const nameError = name.trim().length < 1 ? "Add your name." : null;
  const emailError = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? "Add an email address, like you@example.com."
    : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (nameError || emailError) {
      document.getElementById(nameError ? "name" : "email")?.focus();
      return;
    }
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
    <main className={styles.wrap} id="main" tabIndex={-1}>
      <div className={styles.top}>
        <Brand size={24} />
        <ThemeToggle />
      </div>
      <div className={styles.body}>
        <div className={styles.card}>
          <Link href="/" className={styles.back}>
            <ArrowLeft aria-hidden="true" />
            Back to home
          </Link>
          <span className={styles.step}>One step before your first proofhold</span>
          <h1 className={styles.title}>Name your workspace</h1>
          <p className={styles.lead}>
            A workspace is where your proofholds live. Your name appears on the links you
            send, and your email is where your own notifications go. In this build,
            payouts go to the deployment's PayPal business account; Settings explains.
          </p>
          <form onSubmit={submit} className={styles.form} noValidate>
            <Field label="Your name" htmlFor="name" error={touched ? nameError : null}>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                aria-invalid={touched && nameError ? true : undefined}
                maxLength={80}
                autoFocus
              />
            </Field>
            <Field
              label="Contact email"
              htmlFor="email"
              hint="Notifications about your proofholds go here."
              error={touched ? emailError : null}
            >
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={touched && emailError ? true : undefined}
                maxLength={200}
              />
            </Field>
            {error ? <Note tone="fail">{error}</Note> : null}
            <div className={styles.actions}>
              <Button
                type="submit"
                size="lg"
                loading={pending}
                disabled={!hydrated}
                block
              >
                Continue
              </Button>
              <Button href="/" variant="ghost" block>
                Cancel
              </Button>
            </div>
          </form>
          <p className={styles.fine}>
            No password. This browser is remembered with a signed cookie; clear it from
            Settings.
          </p>
          <div className={styles.next}>
            <span className={styles.nextTitle}>What happens next</span>
            <ol className={styles.nextList}>
              <li>Describe the job and get an acceptance test you can edit.</li>
              <li>
                Send the buyer one link. They approve a PayPal hold against that test.
              </li>
              <li>Deliver here. The checks run, and the hold is released or returned.</li>
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}
