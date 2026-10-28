"use client";

import { useEffect, useState } from "react";
import { durationLeft } from "@/lib/format";
import styles from "./proofhold.module.css";

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  const left = durationLeft(to, now);
  return (
    <time dateTime={to} className={styles.countdown}>
      {left === "now" ? "any moment now" : `in ${left}`}
    </time>
  );
}
