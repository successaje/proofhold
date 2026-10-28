"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormRow, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export function SettingsForm({
  workspace,
}: {
  workspace: { id: string; name: string; email: string };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(workspace.name);
  const [email, setEmail] = useState(workspace.email);
  const [pending, setPending] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast("Workspace saved", "pass");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save", "fail");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} style={{ display: "grid", gap: "var(--s-4)" }}>
      <FormRow>
        <Field label="Name" htmlFor="ws-name">
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
        </Field>
        <Field label="PayPal email" htmlFor="ws-email">
          <Input
            id="ws-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={200}
          />
        </Field>
      </FormRow>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {workspace.id}
        </span>
        <Button type="submit" loading={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}
