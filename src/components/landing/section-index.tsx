"use client";

import { useEffect, useState } from "react";
import styles from "./section-index.module.css";

/** The sticky index at the left of the landing: mono caps, a dash that follows the section in view. */
export function SectionIndex({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    const els = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;
    // The active section is the topmost one crossing the band 15–35% down the
    // viewport; IntersectionObserver only reports changes, so keep the set.
    const inBand = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) inBand.add(e.target.id);
          else inBand.delete(e.target.id);
        const top = els
          .filter((el) => inBand.has(el.id))
          .sort(
            (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
          )[0];
        if (top) setActive(top.id);
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav className={styles.index} aria-label="Sections">
      <ol>
        {items.map((it) => (
          <li key={it.id} className={active === it.id ? styles.active : undefined}>
            <a href={`#${it.id}`} aria-current={active === it.id ? "true" : undefined}>
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
