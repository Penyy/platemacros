import { useEffect } from "react";

/**
 * iOS-proof background scroll lock.
 * Pins <body> with position:fixed, remembers the current scroll position,
 * and restores it on close. Plain overflow:hidden is not reliable on iOS Safari.
 */
export function useScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    if (typeof document === "undefined") return;

    const body = document.body;
    const html = document.documentElement;
    const scrollY =
      window.scrollY || window.pageYOffset || html.scrollTop || 0;

    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscroll: body.style.overscrollBehavior,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      body.style.overscrollBehavior = prev.overscroll;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);
}
