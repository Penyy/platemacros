import { useEffect } from "react";

/**
 * Lock background scroll while an overlay is open.
 * Works on iOS Safari where `overflow:hidden` on body alone is not enough.
 * The overlay's own scrollable content must use its own `overflow-y:auto` container.
 */
export function useScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const y = window.scrollY;
    const b = document.body;
    const prev = {
      position: b.style.position,
      top: b.style.top,
      width: b.style.width,
      overflow: b.style.overflow,
    };

    b.style.position = "fixed";
    b.style.top = `-${y}px`;
    b.style.width = "100%";
    b.style.overflow = "hidden";

    return () => {
      b.style.position = prev.position;
      b.style.top = prev.top;
      b.style.width = prev.width;
      b.style.overflow = prev.overflow;
      window.scrollTo(0, y);
    };
  }, [isOpen]);
}
