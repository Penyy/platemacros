import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, BarChart3, User, Settings as Cog, Plus } from "lucide-react";

interface Props {
  onAdd: () => void;
}

const TABS = [
  { to: "/", label: "Dziś", icon: Home },
  { to: "/stats", label: "Statystyki", icon: BarChart3 },
  { to: "/profile", label: "Profil", icon: User },
  { to: "/settings", label: "Ustawienia", icon: Cog },
] as const;

export function BottomNav({ onAdd }: Props) {
  const loc = useLocation();
  const path = loc.pathname;

  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[430px] justify-center px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <nav className="glass pointer-events-auto relative flex w-full items-center justify-between gap-1 rounded-full px-2 py-2">
        {left.map((t) => (
          <NavItem key={t.to} {...t} active={path === t.to} />
        ))}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onAdd}
          className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/20"
          aria-label="Dodaj"
          style={{
            boxShadow:
              "0 8px 24px -6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        >
          <Plus size={22} />
        </motion.button>
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
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 transition ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      <Icon size={20} />
      <span className="text-[10px] font-medium tracking-wide">{label}</span>
    </Link>
  );
}
