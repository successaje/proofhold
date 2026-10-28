import type { ComponentProps, ReactNode } from "react";
import styles from "./form.module.css";

interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: FieldProps) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label className={styles.label} htmlFor={htmlFor}>
        <span>{label}</span>
        {optional ? <span className={styles.optional}>Optional</span> : null}
      </label>
      {children}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input className={[styles.control, className].filter(Boolean).join(" ")} {...props} />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={[styles.control, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={[styles.control, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function PrefixedInput({
  prefix,
  ...props
}: ComponentProps<"input"> & { prefix: string }) {
  return (
    <div className={styles.prefix}>
      <span className={styles.prefixLabel} aria-hidden="true">
        {prefix}
      </span>
      <Input {...props} />
    </div>
  );
}

export function FormRow({ children, cols = 2 }: { children: ReactNode; cols?: number }) {
  return (
    <div className={styles.row} style={{ ["--cols" as string]: cols }}>
      {children}
    </div>
  );
}

export function Checkbox({
  label,
  ...props
}: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
