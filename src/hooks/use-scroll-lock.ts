import { useEffect } from "react";

/**
 * iOS-PWA-proof background scroll lock.
 *
 * Two layers, because on iOS Safari / standalone PWA neither alone is enough:
 *  1) Pin <body> with position:fixed (remembers & restores scroll position).
 *  2) A global non-passive touchmove guard that only allows finger-scrolling
 *     inside a scrollable element of the open sheet, and blocks everything else
 *     (the backdrop and the page behind it), including edge overscroll chaining.
 *
 * Ref-counted so stacked sheets (e.g. product sheet + delete confirm) behave.
 */

let locks = 0;
let savedY = 0;
let touchStartY = 0;

function findScrollable(start: EventTarget | null): HTMLElement | null {
  let node = start instanceof HTMLElement ? start : null;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    if (
      (oy === "auto" || oy === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 1) touchStartY = e.touches[0].clientY;
}

function onTouchMove(e: TouchEvent) {
  // Allow pinch/zoom and multi-touch gestures through.
  if (e.touches.length !== 1) return;

  const scroller = findScrollable(e.target);
  if (!scroller) {
    // Nothing scrollable under the finger -> this is the backdrop/background.
    if (e.cancelable) e.preventDefault();
    return;
  }

  const dy = e.touches[0].clientY - touchStartY;
  const atTop = scroller.scrollTop <= 0;
  const atBottom =
    scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;

  // Stop the scroll from "leaking" to the background at the edges.
  if ((atTop && dy > 0) || (atBottom && dy < 0)) {
    if (e.cancelable) e.preventDefault();
  }
}

export function useScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    if (typeof document === "undefined") return;

    const body = document.body;

    if (locks === 0) {
      savedY =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        0;

      body.style.position = "fixed";
      body.style.top = `-${savedY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";

      document.addEventListener("touchstart", onTouchStart, { passive: true });
      document.addEventListener("touchmove", onTouchMove, { passive: false });
    }
    locks += 1;

    return () => {
      locks -= 1;
      if (locks <= 0) {
        locks = 0;
        document.removeEventListener("touchstart", onTouchStart);
        document.removeEventListener("touchmove", onTouchMove as EventListener);

        body.style.position = "";
        body.style.top = "";
        body.style.left = "";
        body.style.right = "";
        body.style.width = "";
        body.style.overflow = "";

        window.scrollTo(0, savedY);
      }
    };
  }, [isOpen]);
}
