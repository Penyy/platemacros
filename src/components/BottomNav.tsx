import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, BarChart3, BookOpen, Settings as Cog } from "lucide-react";
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

export function BottomNav({ onAdd }: Props) {
  const { t } = useTranslation();
  const loc = useLocation();
  const path = loc.pathname;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[430px] items-center gap-2 px-3 pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-2"
    >
      {/* Tab group */}
      <nav
        className="pointer-events-auto grid flex-1 grid-cols-4 items-center rounded-[28px] bg-card px-2 py-1.5"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        {TABS.map((t) => (
          <NavItem key={t.to} {...t} active={path === t.to} />
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
      style={{ color: active ? "var(--ink)" : "var(--muted-foreground)" }}
    >
      <span
        className="grid h-8 w-8 place-items-center rounded-full transition-colors"
        style={{
          background: active
            ? "color-mix(in oklab, var(--ink) 8%, transparent)"
            : "transparent",
        }}
      >
        <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
      </span>
      <span
        className="text-[10px] tracking-tight"
        style={{ fontWeight: active ? 800 : 600 }}
      >
        {label}
      </span>
    </Link>
  );
}
