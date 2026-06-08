import { useEffect } from "react";

/**
 * Lock background scroll while an overlay is open.
 * Uses a reference counter so multiple stacked overlays cooperate, and the
 * body is only mutated while at least one overlay is open. iOS Safari safe.
 */

let lockCount = 0;
let savedY = 0;

function lockBody() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (lockCount === 0) {
    savedY = window.scrollY;
    const b = document.body;
    b.style.position = "fixed";
    b.style.top = `-${savedY}px`;
    b.style.width = "100%";
    b.style.overflow = "hidden";
  }
  lockCount++;
}

function unlockBody() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const b = document.body;
    b.style.position = "";
    b.style.top = "";
    b.style.width = "";
    b.style.overflow = "";
    window.scrollTo(0, savedY);
  }
}

export function useScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    lockBody();
    return () => unlockBody();
  }, [isOpen]);
}
