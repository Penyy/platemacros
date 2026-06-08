import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, BarChart3, BookOpen, Settings as Cog } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  onAdd: () => void;
}

const TABS = [
  { to: "/", key: "today", icon: Home },
  { to: "/stats", key: "stats", icon: BarChart3 },
  { to: "/products", key: "products", icon: BookOpen },
  { to: "/settings", key: "settings", icon: Cog },
] as const;

const INDICATOR_SIZE = 32; // matches h-8 w-8

export function BottomNav({ onAdd }: Props) {
  const { t } = useTranslation();
  const loc = useLocation();
  const path = loc.pathname;

  const activeIndex = Math.max(
    0,
    TABS.findIndex((tab) => tab.to === path),
  );

  const navRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [target, setTarget] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  const recompute = () => {
    const el = tabRefs.current[activeIndex];
    if (!el) return;
    const iconEl = el.querySelector<HTMLElement>("[data-nav-icon]");
    const x = el.offsetLeft + (el.offsetWidth - INDICATOR_SIZE) / 2;
    const y = iconEl
      ? el.offsetTop + iconEl.offsetTop + (iconEl.offsetHeight - INDICATOR_SIZE) / 2
      : el.offsetTop;
    setTarget({ x, y });
    setReady(true);
  };

  useLayoutEffect(() => {
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  useEffect(() => {
    const onResize = () => recompute();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[430px] items-center gap-2 px-3 pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-2">
      {/* Tab group */}
      <nav
        ref={navRef}
        className="pointer-events-auto relative grid flex-1 grid-cols-4 items-center rounded-[28px] bg-card px-2 py-1.5"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        {/* Sliding indicator */}
        <motion.div
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: INDICATOR_SIZE,
            height: INDICATOR_SIZE,
            top: "50%",
            left: 0,
            marginTop: -INDICATOR_SIZE / 2 - 6, // align with icon (icon sits above label)
            background: "color-mix(in oklab, var(--ink) 8%, transparent)",
            transformOrigin: "center",
            zIndex: 0,
            opacity: ready ? 1 : 0,
          }}
          initial={false}
          animate={{ x: targetX, scaleX: [1.3, 1], scaleY: [0.9, 1] }}
          transition={{
            x: { type: "spring", stiffness: 320, damping: 30 },
            scaleX: { duration: 0.35, ease: "easeOut" },
            scaleY: { duration: 0.35, ease: "easeOut" },
          }}
        />

        {TABS.map((tab, i) => (
          <NavItem
            key={tab.to}
            to={tab.to}
            label={t(`nav.${tab.key}`)}
            icon={tab.icon}
            active={i === activeIndex}
            innerRef={(el) => {
              tabRefs.current[i] = el;
            }}
          />
        ))}
      </nav>

      {/* Separate "+" pill */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onAdd}
        aria-label="Dodaj"
        className="pointer-events-auto grid h-14 w-14 shrink-0 place-items-center rounded-full"
        style={{
          background: "var(--accent-yellow)",
          boxShadow:
            "0 10px 24px -6px color-mix(in oklab, var(--accent-yellow) 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.35)",
        }}
      >
        <span
          aria-hidden
          style={{
            color: "var(--ink)",
            fontFamily: "Manrope, sans-serif",
            fontWeight: 800,
            fontSize: 34,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            marginTop: -2,
          }}
        >
          +
        </span>
      </motion.button>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  innerRef,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  active: boolean;
  innerRef: (el: HTMLAnchorElement | null) => void;
}) {
  return (
    <Link
      to={to}
      ref={innerRef}
      className="relative flex flex-col items-center justify-center gap-0.5 py-1"
      style={{ color: active ? "var(--ink)" : "var(--muted-foreground)", zIndex: 1 }}
    >
      <span className="relative grid h-8 w-8 place-items-center rounded-full">
        <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
      </span>
      <span className="text-[10px] tracking-tight" style={{ fontWeight: active ? 800 : 600 }}>
        {label}
      </span>
    </Link>
  );
}
