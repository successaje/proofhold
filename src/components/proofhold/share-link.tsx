"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/feedback";
import styles from "./proofhold.module.css";

export function ShareLink({ url }: { url: string }) {
  return (
    <div className={styles.linkBox}>
      <code title={url}>{url}</code>
      <div style={{ display: "flex", gap: "var(--s-1)", alignItems: "center" }}>
        <CopyButton value={url} label="Copy link" />
        <Button
          href={url}
          target="_blank"
          rel="noreferrer"
          variant="secondary"
          size="sm"
          icon={<ExternalLink />}
        >
          Open
        </Button>
      </div>
    </div>
  );
}
