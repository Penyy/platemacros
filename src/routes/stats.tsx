import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ScreenHeader } from "@/components/ScreenHeader";
import { sumEntries, usePlate, ymd } from "@/lib/store";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Plate — Statystyki" },
      {
        name: "description",
        content: "Trendy kalorii i makro z ostatnich dni.",
      },
    ],
  }),
  component: StatsPage,
});

type Range = 7 | 30;

function StatsPage() {
  const entries = usePlate((s) => s.entries);
  const profile = usePlate((s) => s.profile);
  const [range, setRange] = useState<Range>(7);

  const days = useMemo(() => {
    const out: { date: string; label: string; totals: ReturnType<typeof sumEntries> }[] = [];
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const date = ymd(d);
      const dayEntries = entries.filter((e) => e.date === date);
      out.push({
        date,
        label: d.toLocaleDateString("pl-PL", { weekday: "short" }).slice(0, 2),
        totals: sumEntries(dayEntries),
      });
    }
    return out;
  }, [entries, range]);

  const loggedDays = days.filter((d) => d.totals.kcal > 0).length;
  const avg = loggedDays === 0
    ? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    : {
        kcal: Math.round(days.reduce((s, d) => s + d.totals.kcal, 0) / loggedDays),
        protein: Math.round(days.reduce((s, d) => s + d.totals.protein, 0) / loggedDays),
        carbs: Math.round(days.reduce((s, d) => s + d.totals.carbs, 0) / loggedDays),
        fat: Math.round(days.reduce((s, d) => s + d.totals.fat, 0) / loggedDays),
      };

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].totals.kcal > 0) streak++;
    else break;
  }

  return (
    <div className="pb-4">
      <ScreenHeader title="Statystyki" subtitle={`Ostatnie ${range} dni`} />

      <div className="px-[18px] space-y-3">
        <Pills value={range} onChange={setRange} />

        <div className="grid grid-cols-2 gap-2.5">
          <StatCard label="Dni z wpisem" value={`${loggedDays}/${range}`} />
          <StatCard label="Seria" value={`${streak} ${streak === 1 ? "dzień" : "dni"}`} />
        </div>

        <ChartCard
          title="Kalorie"
          unit="kcal"
          color="var(--ink)"
          goal={profile.goal_kcal}
          values={days.map((d) => ({ label: d.label, v: Math.round(d.totals.kcal) }))}
          avg={avg.kcal}
        />
        <ChartCard
          title="Białko"
          unit="g"
          color="var(--macro-protein)"
          goal={profile.goal_protein}
          values={days.map((d) => ({ label: d.label, v: d.totals.protein }))}
          avg={avg.protein}
        />
        <ChartCard
          title="Węglowodany"
          unit="g"
          color="var(--macro-carbs)"
          goal={profile.goal_carbs}
          values={days.map((d) => ({ label: d.label, v: d.totals.carbs }))}
          avg={avg.carbs}
        />
        <ChartCard
          title="Tłuszcz"
          unit="g"
          color="var(--macro-fat)"
          goal={profile.goal_fat}
          values={days.map((d) => ({ label: d.label, v: d.totals.fat }))}
          avg={avg.fat}
        />
      </div>
    </div>
  );
}

function Pills({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div
      className="flex gap-1 rounded-full p-1"
      style={{ background: "var(--hairline)" }}
    >
      {([7, 30] as Range[]).map((r) => {
        const active = value === r;
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            className="flex-1 rounded-full px-3 py-1.5 text-xs transition active:scale-[0.98]"
            style={{
              background: active ? "#1B1B19" : "transparent",
              color: active ? "#FBF4E2" : "var(--muted-foreground)",
              fontWeight: active ? 700 : 600,
            }}
          >
            {r} dni
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-[24px] bg-card p-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </div>
      <div className="num-tight mt-1 text-[22px]" style={{ fontWeight: 800, color: "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  unit,
  color,
  goal,
  values,
  avg,
}: {
  title: string;
  unit: string;
  color: string;
  goal: number;
  values: { label: string; v: number }[];
  avg: number;
}) {
  const max = Math.max(goal * 1.1, ...values.map((d) => d.v), 1);
  const showLabels = values.length <= 7;

  return (
    <div
      className="rounded-[24px] bg-card p-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-end justify-between">
        <div>
          <div
            className="text-[11px] font-semibold"
            style={{ color: "var(--muted-foreground)" }}
          >
            {title}
          </div>
          <div
            className="num-tight mt-0.5 text-[18px]"
            style={{ fontWeight: 800, color: "var(--ink)" }}
          >
            śr. {Math.round(avg)} {unit}
          </div>
        </div>
        <div
          className="num-tight text-right text-[11px]"
          style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
        >
          cel {goal} {unit}
        </div>
      </div>

      <div className="relative mt-3 h-24">
        {/* Goal line (dashed) */}
        <div
          className="absolute left-0 right-0 border-t border-dashed"
          style={{
            bottom: `${(goal / max) * 100}%`,
            borderColor: "color-mix(in oklab, var(--ink) 25%, transparent)",
          }}
        />
        {/* Average line (solid, accent) */}
        {avg > 0 && (
          <div
            className="absolute left-0 right-0"
            style={{
              bottom: `${(avg / max) * 100}%`,
              height: 1.5,
              background: "var(--accent-yellow)",
              opacity: 0.9,
            }}
          />
        )}
        <div className="flex h-full items-end gap-[3px]">
          {values.map((d, i) => {
            const h = Math.min(100, (d.v / max) * 100);
            const hit = d.v > 0 && d.v >= goal * 0.9 && d.v <= goal * 1.1;
            return (
              <div key={i} className="relative flex-1" style={{ height: "100%" }}>
                <motion.div
                  className="absolute bottom-0 left-0 right-0 rounded-t-md"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.02 }}
                  style={{
                    background: color,
                    opacity: d.v === 0 ? 0.15 : hit ? 1 : 0.7,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {showLabels && (
        <div className="mt-1.5 flex gap-[3px]">
          {values.map((d, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[10px]"
              style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
            >
              {d.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
