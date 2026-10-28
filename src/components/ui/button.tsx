import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import styles from "./button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Common {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

type ButtonProps = Common &
  Omit<ComponentProps<"button">, keyof Common> & { href?: undefined };
type LinkProps = Common &
  Omit<ComponentProps<typeof Link>, keyof Common> & { href: string };

function classes({
  variant = "primary",
  size = "md",
  loading,
  block,
  className,
}: Common) {
  return [
    styles.button,
    styles[variant],
    styles[size],
    loading && styles.loading,
    block && styles.block,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

function Spinner() {
  return (
    <span className={styles.spinner} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="M12 3a9 9 0 1 0 9 9" />
      </svg>
    </span>
  );
}

export function Button(props: ButtonProps | LinkProps) {
  const { variant, size, loading, block, icon, children, className, ...rest } = props;
  const content = (
    <>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
      {loading ? <Spinner /> : null}
    </>
  );
  if ("href" in rest && typeof rest.href === "string") {
    const { href, ...linkRest } = rest as LinkProps;
    return (
      <Link
        href={href}
        className={classes({ variant, size, loading, block, className })}
        {...(linkRest as object)}
      >
        {content}
      </Link>
    );
  }
  const buttonRest = rest as ComponentProps<"button">;
  return (
    <button
      type={buttonRest.type ?? "button"}
      {...buttonRest}
      disabled={buttonRest.disabled || loading}
      aria-busy={loading || undefined}
      className={classes({ variant, size, loading, block, className })}
    >
      {content}
    </button>
  );
}
