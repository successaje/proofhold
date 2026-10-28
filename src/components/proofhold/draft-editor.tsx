"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import type { AcceptanceTest } from "@/lib/domain/test";
import type { ProofholdView } from "@/lib/view";
import { TestEditor } from "./test-editor";
import styles from "./proofhold.module.css";

export function DraftEditor({ ph }: { ph: ProofholdView }) {
  const router = useRouter();
  const { toast } = useToast();
  const [test, setTest] = useState<AcceptanceTest>(ph.test);
  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(test) !== JSON.stringify(ph.test);
  const invalid =
    test.predicates.length === 0 ||
    test.predicates.some(
      (p) =>
        p.text.trim().length < 3 ||
        (p.check.kind === "judgement" && !p.check.criteria.trim()),
    );

  async function save(then: "stay" | "send") {
    setError(null);
    setBusy(then === "send" ? "send" : "save");
    try {
      if (dirty)
        await api(`/api/proofholds/${ph.id}`, { method: "PATCH", body: { test } });
      if (then === "send") {
        await api(`/api/proofholds/${ph.id}/propose`, { body: {} });
        toast("Sent. Share the buyer link.", "pass");
      } else toast("Draft saved", "pass");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.stack}>
      <TestEditor test={test} onChange={setTest} />
      {error ? <Note tone="fail">{error}</Note> : null}
      <div className={styles.actionsRow}>
        <span className="lead">{dirty ? "Unsaved changes" : "Saved"}</span>
        <Button
          variant="secondary"
          onClick={() => save("stay")}
          loading={busy === "save"}
          disabled={!dirty || invalid || busy !== null}
        >
          Save
        </Button>
        <Button
          onClick={() => save("send")}
          loading={busy === "send"}
          disabled={invalid || busy !== null}
          icon={<Send />}
        >
          Send to the buyer
        </Button>
      </div>
    </div>
  );
}
