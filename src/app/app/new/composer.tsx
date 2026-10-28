"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FormRow,
  Input,
  PrefixedInput,
  Select,
  Textarea,
} from "@/components/ui/field";
import { Note, Panel } from "@/components/ui/panel";
import { Stages } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { TestEditor } from "@/components/proofhold/test-editor";
import type { AcceptanceTest } from "@/lib/domain/test";
import type { Kind } from "@/lib/domain/proofhold";
import type { SystemInfo } from "@/lib/view";
import styles from "./composer.module.css";

interface Draft {
  title: string;
  kind: Kind;
  brief: string;
  amount: string;
  currency: "USD" | "EUR" | "GBP" | "CAD" | "AUD";
  deadline: string;
  buyerEmail: string;
}

export interface ComposerInitial {
  from: { id: string; title: string };
  draft: Draft;
  test: AcceptanceTest;
}

const empty: Draft = {
  title: "",
  kind: "service",
  brief: "",
  amount: "",
  currency: "USD",
  deadline: "",
  buyerEmail: "",
};

const examples: Record<Kind, Draft> = {
  service: {
    title: "Logo concepts for Driftwood Café",
    kind: "service",
    brief:
      "Three logo concepts for a small coastal café called Driftwood. Minimal, two colours at most, must work at favicon size. Deliver as PNG at 300 dpi plus SVG. Due by Friday. One round of revisions after you pick a direction.",
    amount: "420",
    currency: "USD",
    deadline: "",
    buyerEmail: "",
  },
  goods: {
    title: "iPhone 13, 128 GB, blue",
    kind: "goods",
    brief:
      "Used iPhone 13, 128 GB, blue, battery health 88%, no cracks, factory reset, original box. Ships tracked within two days of approval. Buyer confirms on arrival.",
    amount: "310",
    currency: "USD",
    deadline: "",
    buyerEmail: "",
  },
};

export function Composer({
  system,
  initial = null,
}: {
  system: SystemInfo;
  initial?: ComposerInitial | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>(initial?.draft ?? empty);
  const [test, setTest] = useState<AcceptanceTest | null>(initial?.test ?? null);
  const [source, setSource] = useState<"ai" | "starter" | "reused" | null>(
    initial ? "reused" : null,
  );
  const [compiling, setCompiling] = useState(false);
  const [saving, setSaving] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amountCents = Math.round(Number(draft.amount) * 100);
  const briefReady =
    draft.title.trim().length >= 2 &&
    draft.brief.trim().length >= 10 &&
    amountCents >= 100;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  async function compile() {
    setError(null);
    setCompiling(true);
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: draft.brief,
          kind: draft.kind,
          amountCents,
          currency: draft.currency,
          deadline: draft.deadline || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not compile the brief.");
      setTest(body.test);
      setSource(body.source);
      if (body.dropped?.length)
        toast(
          `${body.dropped.length} line(s) could not be expressed as a check and were left out.`,
          "info",
        );
      window.setTimeout(
        () =>
          document
            .getElementById("test-panel")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        50,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not compile the brief.");
    } finally {
      setCompiling(false);
    }
  }

  async function save(mode: "draft" | "send") {
    if (!test) return;
    setError(null);
    setSaving(mode);
    try {
      const res = await fetch("/api/proofholds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          kind: draft.kind,
          brief: draft.brief,
          amountCents,
          currency: draft.currency,
          buyerEmail: draft.buyerEmail || null,
          test,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      const id = body.proofhold.id as string;
      if (mode === "send") {
        const sent = await fetch(`/api/proofholds/${id}/propose`, { method: "POST" });
        const sentBody = await sent.json();
        if (!sent.ok)
          throw new Error(sentBody.error ?? "Saved, but could not mark it as sent.");
      }
      router.push(`/app/h/${id}${mode === "send" ? "?sent=1" : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setSaving(null);
    }
  }

  const testInvalid = test
    ? test.predicates.some(
        (p) =>
          p.text.trim().length < 3 ||
          (p.check.kind === "judgement" && !p.check.criteria.trim()),
      )
    : true;

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <Panel
          title="The job"
          subtitle="Write it the way you would in a message to the buyer. The test is compiled from this."
        >
          <div className={styles.form}>
            <FormRow>
              <Field label="Title" htmlFor="title">
                <Input
                  id="title"
                  value={draft.title}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="Logo concepts for Driftwood Café"
                  maxLength={120}
                />
              </Field>
              <Field label="Kind">
                <div
                  className={styles.segmented}
                  role="radiogroup"
                  aria-label="Kind of job"
                >
                  {(["service", "goods"] as Kind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={draft.kind === k}
                      className={styles.segment}
                      onClick={() => set({ kind: k })}
                    >
                      {k === "service" ? "Service" : "Goods"}
                    </button>
                  ))}
                </div>
              </Field>
            </FormRow>
            <Field
              label="Brief"
              htmlFor="brief"
              hint={
                draft.brief
                  ? `${draft.brief.length} / 6000`
                  : "What is being delivered, what good looks like, and when."
              }
            >
              <Textarea
                id="brief"
                value={draft.brief}
                onChange={(e) => set({ brief: e.target.value })}
                rows={7}
                maxLength={6000}
              />
            </Field>
            <FormRow cols={3}>
              <Field label="Amount" htmlFor="amount">
                <div className={styles.amount}>
                  <PrefixedInput
                    id="amount"
                    prefix={
                      draft.currency === "USD"
                        ? "$"
                        : draft.currency === "EUR"
                          ? "€"
                          : draft.currency === "GBP"
                            ? "£"
                            : "$"
                    }
                    inputMode="decimal"
                    value={draft.amount}
                    onChange={(e) =>
                      set({ amount: e.target.value.replace(/[^\d.]/g, "") })
                    }
                    placeholder="420"
                  />
                  <Select
                    aria-label="Currency"
                    value={draft.currency}
                    onChange={(e) =>
                      set({ currency: e.target.value as Draft["currency"] })
                    }
                  >
                    {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </div>
              </Field>
              <Field label="Deadline" htmlFor="deadline" optional>
                <Input
                  id="deadline"
                  type="date"
                  value={draft.deadline}
                  onChange={(e) => set({ deadline: e.target.value })}
                />
              </Field>
              <Field
                label="Buyer email"
                htmlFor="buyer"
                optional
                hint="Only used to label the proofhold."
              >
                <Input
                  id="buyer"
                  type="email"
                  value={draft.buyerEmail}
                  onChange={(e) => set({ buyerEmail: e.target.value })}
                />
              </Field>
            </FormRow>
            <div className={styles.actions}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft(examples[draft.kind])}
                icon={<Wand2 />}
              >
                Use an example
              </Button>
              <Button
                onClick={compile}
                loading={compiling}
                disabled={!briefReady}
                icon={<Sparkles />}
              >
                {test
                  ? "Compile again"
                  : system.aiAvailable
                    ? "Compile the test"
                    : "Draft a starter test"}
              </Button>
            </div>
            {!system.aiAvailable ? (
              <Note tone="info">
                The AI compiler is off (no ANTHROPIC_API_KEY). You will get a starter test
                to edit by hand.
              </Note>
            ) : null}
          </div>
        </Panel>

        {compiling ? (
          <Panel title="Compiling">
            <Stages
              stages={[
                { label: "Reading the brief", state: "done" },
                { label: "Writing checks a machine can verify", state: "active" },
                { label: "Listing what the brief left unclear", state: "todo" },
              ]}
            />
          </Panel>
        ) : null}

        {test && !compiling ? (
          <Panel
            id="test-panel"
            title="The acceptance test"
            subtitle={
              source === "ai"
                ? `Compiled by ${system.model}. Edit anything; the buyer approves the final text.`
                : source === "reused"
                  ? `Copied from “${initial?.from.title}”. Edit anything; the buyer approves the final text.`
                  : "Starter test. Edit it to match the brief before sending."
            }
          >
            <div className={styles.form}>
              {test.unclear.length > 0 ? (
                <Note tone="held">
                  <strong>Worth clearing up before you send:</strong>
                  <ul className={styles.unclear}>
                    {test.unclear.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                </Note>
              ) : null}
              <TestEditor test={test} onChange={setTest} />
              {error ? <Note tone="fail">{error}</Note> : null}
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  onClick={() => save("draft")}
                  loading={saving === "draft"}
                  disabled={testInvalid || saving !== null}
                >
                  Save as draft
                </Button>
                <Button
                  onClick={() => save("send")}
                  loading={saving === "send"}
                  disabled={testInvalid || saving !== null}
                >
                  Create and get the buyer link
                </Button>
              </div>
            </div>
          </Panel>
        ) : null}
        {error && !test ? <Note tone="fail">{error}</Note> : null}
      </div>

      <aside className={styles.aside}>
        <Panel title="How this works">
          <ol className={styles.steps}>
            <li>
              <strong>You write the brief.</strong> Proofhold compiles it into checks:
              file counts, sizes, deadlines, a tracking number, and a few judgement calls.
            </li>
            <li>
              <strong>The buyer approves with PayPal.</strong> That creates an
              authorization hold for the amount. PayPal keeps the money; nobody else
              touches it.
            </li>
            <li>
              <strong>You deliver here.</strong> Deterministic checks run first. The
              examiner only judges what a machine cannot measure, and it may abstain.
            </li>
            <li>
              <strong>Money follows the test.</strong> Pass and the hold is captured.
              Partial pass releases the agreed share. Objections go to review, and nothing
              moves without a recorded decision.
            </li>
          </ol>
          <Button href="/app" variant="ghost" size="sm" icon={<ArrowLeft />}>
            Back to proofholds
          </Button>
        </Panel>
      </aside>
    </div>
  );
}
