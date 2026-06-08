import { useEffect } from "react";

/**
 * Lock background scroll while an overlay is open.
 * Simple version: toggles document.body overflow only while isOpen is true.
 * Mount the hook inside the overlay component so it only runs when the
 * overlay is actually in the DOM.
 */
export function useScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    if (typeof document === "undefined") return;
    const b = document.body;
    const prev = b.style.overflow;
    b.style.overflow = "hidden";
    return () => {
      b.style.overflow = prev;
    };
  }, [isOpen]);
}
