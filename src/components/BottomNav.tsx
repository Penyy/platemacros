import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, BarChart3, BookOpen, Settings as Cog } from "lucide-react";

interface Props {
  onAdd: () => void;
}

const TABS = [
  { to: "/", label: "Dziś", icon: Home },
  { to: "/stats", label: "Statystyki", icon: BarChart3 },
  { to: "/products", label: "Produkty", icon: BookOpen },
  { to: "/settings", label: "Ustawienia", icon: Cog },
] as const;

export function BottomNav({ onAdd }: Props) {
  const loc = useLocation();
  const path = loc.pathname;

  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] px-0">
      <nav
        className="pointer-events-auto relative grid grid-cols-5 items-center bg-card px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.6rem)]"
        style={{
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          boxShadow:
            "0 -8px 30px rgba(40,28,4,0.08), 0 -2px 8px rgba(40,28,4,0.04)",
        }}
      >
        {left.map((t) => (
          <NavItem key={t.to} {...t} active={path === t.to} />
        ))}
        <div className="flex items-center justify-center">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onAdd}
            aria-label="Dodaj"
            className="grid h-12 w-12 shrink-0 place-items-center text-primary-foreground"
            style={{
              background: "var(--ink)",
              borderRadius: 16,
              boxShadow:
                "0 8px 20px -6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >
            <Plus size={22} strokeWidth={2.2} />
          </motion.button>
        </div>
        {right.map((t) => (
          <NavItem key={t.to} {...t} active={path === t.to} />
        ))}
      </nav>
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
      className="flex flex-col items-center justify-center gap-1 py-1.5"
      style={{ color: active ? "var(--ink)" : "var(--muted-foreground)" }}
    >
      <span
        className="grid h-8 w-8 place-items-center rounded-full"
        style={{
          background: active ? "color-mix(in oklab, var(--ink) 8%, transparent)" : "transparent",
        }}
      >
        <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
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
