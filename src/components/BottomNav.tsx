import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, BarChart3, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  onAdd: () => void;
}

const TABS = [
  { to: "/", key: "today", icon: Home },
  { to: "/stats", key: "stats", icon: BarChart3 },
  { to: "/products", key: "products", icon: ShoppingBag },
  { to: "/settings", key: "settings", icon: SlidersHorizontal },
] as const;

export function BottomNav({ onAdd }: Props) {
  const { t } = useTranslation();
  const loc = useLocation();
  const path = loc.pathname;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[430px] items-center gap-2 px-3 pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-2">
      {/* Tab group */}
      <nav
        className="pointer-events-auto grid flex-1 grid-cols-4 items-center rounded-[28px] px-2 py-1.5"
        style={{
          background: "#17150F",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 10px 30px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {TABS.map((tab) => (
          <NavItem
            key={tab.to}
            to={tab.to}
            label={t(`nav.${tab.key}`)}
            icon={tab.icon}
            active={path === tab.to}
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
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-0.5 py-1"
      style={{ color: active ? "var(--accent-yellow)" : "#8B867C" }}
    >
      <span className="grid h-8 w-8 place-items-center">
        <Icon size={24} strokeWidth={2} />
      </span>
      <span className="text-[10px] tracking-tight" style={{ fontWeight: active ? 800 : 600 }}>
        {label}
      </span>
    </Link>
  );
}
