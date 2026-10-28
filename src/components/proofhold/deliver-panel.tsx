"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { Send, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormRow, Input, Select, Textarea } from "@/components/ui/field";
import { Note, Panel, Section } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import type { EvidenceItem } from "@/lib/domain/proofhold";
import type { ProofholdView } from "@/lib/view";
import { EvidenceList } from "./evidence-list";
import styles from "./proofhold.module.css";

const carriers = [
  "UPS",
  "USPS",
  "FEDEX",
  "DHL",
  "ROYAL_MAIL",
  "CANADA_POST",
  "AUSTRALIA_POST",
  "OTHER",
];

export function DeliverPanel({
  ph,
  evidence,
  aiAvailable,
}: {
  ph: ProofholdView;
  evidence: EvidenceItem[];
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState("UPS");
  const [tracking, setTracking] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wantsTracking = ph.test.predicates.some(
    (p) => p.check.kind === "tracking_shipped",
  );
  const wantsFiles = ph.test.predicates.some(
    (p) => p.evidence === "file" || p.evidence === "judgement",
  );
  const hasTracking = evidence.some((e) => e.kind === "tracking");
  const files = evidence.filter((e) => e.kind === "file");
  const resubmitting = ph.status !== "held";

  async function upload(list: FileList | File[]) {
    const chosen = Array.from(list);
    if (chosen.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      for (const f of chosen) form.append("file", f);
      await api(`/api/proofholds/${ph.id}/evidence`, { form });
      toast(`${chosen.length} file${chosen.length === 1 ? "" : "s"} added`, "pass");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove(item: EvidenceItem) {
    try {
      await api(`/api/proofholds/${ph.id}/evidence/${item.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove", "fail");
    }
  }

  async function saveTracking() {
    setError(null);
    setSavingTracking(true);
    try {
      await api(`/api/proofholds/${ph.id}/tracking`, {
        body: { carrier, number: tracking },
      });
      setTracking("");
      toast("Tracking recorded", "pass");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record tracking.");
    } finally {
      setSavingTracking(false);
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await api<{ examining: boolean }>(
        `/api/proofholds/${ph.id}/submit`,
        { body: { note: note || null } },
      );
      toast(
        result.examining
          ? "Submitted. Checks are running; the examiner follows."
          : "Submitted. Checks are done.",
        "pass",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
      setSubmitting(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
  }

  const canSubmit = evidence.length > 0 && !uploading && !submitting;

  return (
    <Panel
      title={resubmitting ? "Resubmit" : "Deliver"}
      subtitle={
        resubmitting
          ? "Add what was missing and run the checks again. The buyer window restarts."
          : "Upload the deliverables, record tracking if the test asks for it, then submit for checks."
      }
    >
      <div className={styles.stack}>
        {wantsFiles ? (
          <Section title="Files">
            <div
              className={[styles.dropzone, dragging && styles.dropzoneActive]
                .filter(Boolean)
                .join(" ")}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
              }}
              aria-busy={uploading}
            >
              <Upload aria-hidden="true" />
              {uploading ? (
                <span>Uploading…</span>
              ) : (
                <span>
                  <strong>Drop files here</strong> or click to choose · up to 8 MB each
                </span>
              )}
              <span style={{ color: "var(--muted)", fontSize: "var(--text-xs)" }}>
                Images are measured for size and resolution.
                {aiAvailable ? " Images and text are shown to the examiner." : ""}
              </span>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                onChange={(e) => e.target.files && upload(e.target.files)}
              />
            </div>
            <EvidenceList
              items={files}
              actions={(item) => (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 />}
                  aria-label={`Remove ${item.name}`}
                  onClick={() => remove(item)}
                />
              )}
            />
          </Section>
        ) : null}

        {wantsTracking ? (
          <Section title="Shipping">
            {hasTracking ? (
              <EvidenceList items={evidence.filter((e) => e.kind === "tracking")} />
            ) : null}
            <FormRow cols={3}>
              <Field label="Carrier" htmlFor="carrier">
                <Select
                  id="carrier"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                >
                  {carriers.map((c) => (
                    <option key={c} value={c}>
                      {c.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tracking number" htmlFor="tracking">
                <Input
                  id="tracking"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  placeholder="1Z999AA10123456784"
                />
              </Field>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <Button
                  variant="secondary"
                  onClick={saveTracking}
                  loading={savingTracking}
                  disabled={tracking.trim().length < 4}
                >
                  Record
                </Button>
              </div>
            </FormRow>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
              The number format is checked now. After release, the tracker is attached to
              the PayPal order so the buyer sees it in PayPal.
            </p>
          </Section>
        ) : null}

        <Section title="Note to the buyer">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything the buyer should know about this delivery"
            maxLength={2000}
          />
        </Section>

        {error ? <Note tone="fail">{error}</Note> : null}

        <div className={styles.actionsRow}>
          <span className="lead">
            {evidence.length === 0
              ? "Add a file or tracking number to submit."
              : `${evidence.length} item${evidence.length === 1 ? "" : "s"} ready.`}
          </span>
          <Button
            onClick={submit}
            loading={submitting}
            disabled={!canSubmit}
            icon={<Send />}
          >
            Submit for checks
          </Button>
        </div>
      </div>
    </Panel>
  );
}
