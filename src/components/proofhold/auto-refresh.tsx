"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server page on an interval while something is in flight. */
export function AutoRefresh({
  every = 4000,
  active = true,
}: {
  every?: number;
  active?: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => window.clearInterval(t);
  }, [router, every, active]);
  return null;
}
