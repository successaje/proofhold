"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import styles from "./feedback.module.css";

type Tone = "info" | "pass" | "fail";
interface Toast {
  id: number;
  tone: Tone;
  message: string;
}
interface Api {
  toast: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<Api>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const dismiss = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );
  const toast = useCallback(
    (message: string, tone: Tone = "info") => {
      const id = ++counter.current;
      setToasts((t) => [...t.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "fail" ? 7000 : 4000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ toast }), [toast]);
  const icons = { info: Info, pass: CheckCircle2, fail: AlertCircle };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.toasts} aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              className={[styles.toast, styles[`toast-${t.tone}`]].join(" ")}
              role="status"
            >
              <Icon aria-hidden="true" />
              <span>{t.message}</span>
              <button
                className={styles.toastClose}
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
