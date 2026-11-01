"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./feedback.module.css";

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Start the reader at the question, not inside an optional field.
      titleRef.current?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-modal="true"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <header className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle} id={titleId} ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
        </header>
        <div className={styles.dialogBody}>{children}</div>
        {footer ? <footer className={styles.dialogFooter}>{footer}</footer> : null}
      </div>
    </dialog>
  );
}
