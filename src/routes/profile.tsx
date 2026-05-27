import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { usePlate } from "@/lib/store";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Plate — Profil" },
      { name: "description", content: "Twoje cele i rozkład makroskładników." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const p = usePlate((s) => s.profile);
  const pK = p.goal_protein * 4;
  const cK = p.goal_carbs * 4;
  const fK = p.goal_fat * 9;
  const total = pK + cK + fK;
  const pct = (k: number) => (total ? Math.round((k / total) * 100) : 0);

  return (
    <div>
      <ScreenHeader title="Profil" />

      <div className="px-4 space-y-3">
        <Link
          to="/settings"
          className="flex items-center gap-3 rounded-3xl bg-card p-4"
        >
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Cele dzienne
            </div>
            <div className="num-tight mt-0.5 text-lg font-semibold">
              {p.goal_kcal} kcal · B {p.goal_protein} · W {p.goal_carbs} · T{" "}
              {p.goal_fat}
            </div>
          </div>
          <ChevronRight size={20} className="text-muted-foreground" />
        </Link>

        <div className="rounded-3xl bg-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Rozkład makro
          </div>
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              style={{
                width: `${pct(pK)}%`,
                background: "var(--protein)",
              }}
            />
            <div
              style={{ width: `${pct(cK)}%`, background: "var(--carbs)" }}
            />
            <div style={{ width: `${pct(fK)}%`, background: "var(--fat)" }} />
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Row label="Białko" g={p.goal_protein} pct={pct(pK)} color="var(--protein)" />
            <Row label="Węgle" g={p.goal_carbs} pct={pct(cK)} color="var(--carbs)" />
            <Row label="Tłuszcz" g={p.goal_fat} pct={pct(fK)} color="var(--fat)" />
          </ul>
        </div>

        <div className="rounded-3xl bg-card p-8 text-center">
          <h2 className="text-base font-semibold">Profil ciała</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Waga, obwody i pomiary pojawią się w kolejnym etapie.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  g,
  pct,
  color,
}: {
  label: string;
  g: number;
  pct: number;
  color: string;
}) {
  return (
    <li className="rounded-2xl bg-foreground/5 px-2 py-2">
      <div className="flex items-center justify-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="num-tight mt-0.5 text-sm">
        <span className="font-semibold">{g} g</span>{" "}
        <span className="text-muted-foreground">· {pct}%</span>
      </div>
    </li>
  );
}
