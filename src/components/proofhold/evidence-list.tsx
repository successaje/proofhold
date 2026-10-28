import { FileText, Image as ImageIcon, Package, Paperclip } from "lucide-react";
import type { EvidenceItem } from "@/lib/domain/proofhold";
import { formatBytes } from "@/lib/domain/test";
import { formatDate } from "@/lib/format";
import styles from "./proofhold.module.css";

export function EvidenceList({
  items,
  token,
  actions,
}: {
  items: EvidenceItem[];
  token?: string;
  actions?: (item: EvidenceItem) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  const href = (e: EvidenceItem) =>
    `/api/evidence/${e.id}${token ? `?t=${encodeURIComponent(token)}` : ""}`;
  return (
    <ul className={styles.files}>
      {items.map((e) => {
        const isImage = e.mime?.startsWith("image/") && e.mime !== "image/svg+xml";
        const Icon =
          e.kind === "tracking"
            ? Package
            : e.mime?.startsWith("image/")
              ? ImageIcon
              : e.mime?.startsWith("text/")
                ? FileText
                : Paperclip;
        return (
          <li key={e.id} className={styles.file}>
            {e.kind === "file" && isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.thumb} src={href(e)} alt="" loading="lazy" />
            ) : (
              <span className={styles.thumb}>
                <Icon aria-hidden="true" />
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              {e.kind === "file" ? (
                <a
                  className={styles.fileName}
                  href={href(e)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "block" }}
                >
                  {e.name}
                </a>
              ) : (
                <span className={styles.fileName} style={{ display: "block" }}>
                  {e.name}
                </span>
              )}
              <span className={styles.fileMeta}>
                {e.kind === "file"
                  ? [
                      e.mime ?? "unknown type",
                      formatBytes(e.size),
                      e.metadata.width
                        ? `${e.metadata.width}×${e.metadata.height}`
                        : null,
                      e.metadata.dpi && e.metadata.dpi !== "vector"
                        ? `${e.metadata.dpi} dpi`
                        : null,
                      e.sha256 ? `sha256 ${e.sha256.slice(0, 10)}…` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : `tracking · ${formatDate(e.createdAt)}`}
              </span>
            </div>
            <div className={styles.fileActions}>{actions ? actions(e) : null}</div>
          </li>
        );
      })}
    </ul>
  );
}
