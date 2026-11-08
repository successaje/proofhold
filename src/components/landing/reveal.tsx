"use client";

import { createElement, useEffect, useRef, type ReactNode } from "react";
import styles from "./reveal.module.css";

/**
 * Rises 12 px and fades in the first time it scrolls into view. Anything the
 * reader has already scrolled past (an anchor jump, a fast wheel) is shown at
 * once, so nothing is ever left blank. The global reduced-motion rule collapses
 * the transition, so it simply appears.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Render as a list item when the parent is a list; a wrapper div would break the list. */
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Server HTML is fully visible. Only what is below the fold at mount is
    // hidden, then revealed as it enters; readers without JS see everything.
    if (el.getBoundingClientRect().top <= window.innerHeight * 0.9) return;
    el.classList.add(styles.hidden!);
    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      el.classList.add(styles.shown!);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting || e.boundingClientRect.top < 0) show();
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );
    const onScroll = () => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) show();
    };
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return createElement(
    as,
    {
      ref,
      className: [styles.reveal, className].filter(Boolean).join(" "),
      "data-reveal": "",
      style: delay ? { transitionDelay: `${delay}ms` } : undefined,
    },
    children,
  );
}
