import { useEffect } from "react";

let locks = 0;
let savedY = 0;
let touchStartY = 0;

function findScrollable(start: EventTarget | null): HTMLElement | null {
  let node = start instanceof HTMLElement ? start : null;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) {
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
  if (e.touches.length !== 1) return;
  const scroller = findScrollable(e.target);
  if (!scroller) {
    if (e.cancelable) e.preventDefault();
    return;
  }
  const dy = e.touches[0].clientY - touchStartY;
  const atTop = scroller.scrollTop <= 0;
  const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
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
      savedY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
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
