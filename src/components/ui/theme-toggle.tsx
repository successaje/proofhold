"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  applyTheme,
  effectiveTheme,
  storedTheme,
  THEME_EVENT,
  type ThemeChoice,
} from "@/lib/theme";
import styles from "./theme-toggle.module.css";

function subscribe(onChange: () => void) {
  const query = matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  query.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    query.removeEventListener("change", onChange);
  };
}

/** "light" or "dark" once mounted; null on the server and during hydration. */
function useEffectiveTheme(): "light" | "dark" | null {
  return useSyncExternalStore(subscribe, effectiveTheme, () => null);
}

function useStoredTheme(): ThemeChoice | null {
  return useSyncExternalStore(subscribe, storedTheme, () => null);
}

/** One button in a header: flips between light and dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useEffectiveTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className={[styles.toggle, className].filter(Boolean).join(" ")}
      onClick={() => applyTheme(next)}
      aria-label={theme ? `Switch to ${next} theme` : "Switch theme"}
      title={theme ? `Switch to ${next} theme` : "Switch theme"}
    >
      <span
        className={styles.icons}
        data-theme-now={theme ?? "unknown"}
        aria-hidden="true"
      >
        <Sun className={styles.sun} />
        <Moon className={styles.moon} />
      </span>
    </button>
  );
}

const CHOICES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** The full choice, for Settings: follow the system, or pin light or dark. */
export function ThemeChoiceControl() {
  const stored = useStoredTheme();
  return (
    <div className={styles.choices} role="radiogroup" aria-label="Theme">
      {CHOICES.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={stored === c.value}
          className={styles.choice}
          onClick={() => applyTheme(c.value)}
        >
          <c.icon aria-hidden="true" />
          {c.label}
        </button>
      ))}
    </div>
  );
}
