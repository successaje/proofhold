"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Note, Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import styles from "./danger.module.css";

/** Take your data with you, or remove it. Deletion asks for the workspace name and cannot be undone. */
export function DangerZone({ workspaceName }: { workspaceName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await api("/api/workspace", { method: "DELETE", body: { confirm } });
      toast("Workspace deleted.", "info");
      router.push("/app/start");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete.", "fail");
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Your data"
      subtitle="Export everything, or delete the workspace and all of it."
    >
      <div className={styles.row}>
        <div>
          <strong>Export</strong>
          <p>
            One JSON file: the workspace, every proofhold with its test, checks,
            decisions, messages, evidence fingerprints and hash-chained history. File
            bytes are downloaded from each proofhold page.
          </p>
        </div>
        <Button
          href="/api/workspace/export"
          variant="secondary"
          size="sm"
          icon={<Download />}
        >
          Export JSON
        </Button>
      </div>
      <div className={styles.row}>
        <div>
          <strong>Delete the workspace</strong>
          <p>
            Removes the workspace, its proofholds, evidence, checks, decisions, messages
            and history from this deployment. PayPal keeps its own records. Active holds
            are not voided by this; end them first so the buyer's money is not left
            reserved.
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 />}
          onClick={() => setOpen(true)}
        >
          Delete…
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this workspace?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={confirm.trim() !== workspaceName}
              onClick={remove}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <Note tone="fail">
          This cannot be undone. Export first if you might want the record later.
        </Note>
        <Field
          label={`Type the workspace name, ${workspaceName}, to confirm`}
          htmlFor="confirm-delete"
        >
          <Input
            id="confirm-delete"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
          />
        </Field>
      </Dialog>
    </Panel>
  );
}
