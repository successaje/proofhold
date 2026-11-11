/**
 * Light, dark, or the system's choice. Nothing is stored until the visitor
 * picks; until then the page follows the operating system.
 *
 * The same key and attribute are read by the inline script in the root
 * layout, which sets the theme before first paint.
 */
export type ThemeChoice = "system" | "light" | "dark";
export const THEME_KEY = "proofhold:theme";
export const THEME_EVENT = "proofhold:theme";

export function storedTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "dark" || value === "light" ? value : "system";
  } catch {
    return "system";
  }
}

/** The theme on screen now, resolving "system". */
export function effectiveTheme(): "light" | "dark" {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "dark" || set === "light") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Apply and remember a choice. Where the browser supports view transitions
 * the change crossfades; colours themselves never transition, so no element
 * is ever caught between two themes.
 */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  const set = () => {
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
    window.dispatchEvent(new Event(THEME_EVENT));
  };
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // The choice still applies for this visit.
  }
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => {
      ready: Promise<void>;
      skipTransition: () => void;
    };
  };
  if (reduced || !doc.startViewTransition) {
    set();
    return;
  }
  const transition = doc.startViewTransition(set);
  transition.ready.catch(() => undefined);
  // A tab the browser is not painting may never run the first frame.
  setTimeout(() => transition.skipTransition(), 400);
}

/** Inline, before paint: apply a stored choice so the page never flashes. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
