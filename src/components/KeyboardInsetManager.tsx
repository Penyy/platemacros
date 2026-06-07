import { useEffect } from "react";

/**
 * Tracks the on-screen keyboard via window.visualViewport and writes
 * --kb-inset on <html> so fixed bottom sheets can sit above the keyboard.
 */
export function KeyboardInsetManager() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const inset = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      );
      document.documentElement.style.setProperty(
        "--kb-inset",
        `${Math.round(inset)}px`
      );
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--kb-inset");
    };
  }, []);
  return null;
}
