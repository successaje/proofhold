"use client";

import { useEffect, useState } from "react";
import styles from "./rotator.module.css";

/**
 * "For freelancers", cycling through who Proofhold serves. Assistive tech
 * gets the whole list once; the moving word is decoration. With reduced
 * motion the first word stays put.
 */
export function Rotator({ lead, words }: { lead: string; words: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setI((n) => (n + 1) % words.length), 2600);
    return () => clearInterval(timer);
  }, [words.length]);
  return (
    <p className={styles.rotator}>
      <span className="sr-only">
        {lead} {words.join(", ")}
      </span>
      <span aria-hidden="true">{lead}</span>
      <span className={styles.slot} aria-hidden="true">
        <span key={i} className={styles.word}>
          {words[i]}
        </span>
      </span>
    </p>
  );
}
