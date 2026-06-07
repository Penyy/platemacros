import { useEffect } from "react";

/**
 * Ensures the focused input/textarea scrolls into view above the on-screen
 * keyboard on mobile. Runs once globally.
 */
export function KeyboardScrollManager() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isEditable = (el: EventTarget | null): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        el.isContentEditable
      );
    };

    const handleFocus = (e: FocusEvent) => {
      const el = e.target;
      if (!isEditable(el)) return;
      // Delay so the virtual keyboard has time to appear and shrink the viewport.
      window.setTimeout(() => {
        try {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch {
          el.scrollIntoView();
        }
      }, 250);
    };

    document.addEventListener("focusin", handleFocus);
    return () => document.removeEventListener("focusin", handleFocus);
  }, []);

  return null;
}
