"use client";

import { useEffect, useState } from "react";

/**
 * True once React has mounted on the client. Primary controls on forms stay
 * disabled until then, so a click that lands before hydration is never a
 * native form submit (which would put the fields in the URL) or a lost click.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
