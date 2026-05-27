import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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

  // Streak (consecutive days from today with kcal > 0)
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].totals.kcal > 0) streak++;
    else break;
  }

  return (
    <div>
      <ScreenHeader title="Statystyki" subtitle={`Ostatnie ${range} dni`} />

      <div className="px-4 space-y-4">
        <div className="flex gap-1 rounded-full bg-foreground/5 p-1">
          {([7, 30] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {r} dni
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Dni z wpisem" value={`${loggedDays}/${range}`} />
          <StatCard label="Seria" value={`${streak} ${streak === 1 ? "dzień" : "dni"}`} />
        </div>

        <ChartCard
          title="Kalorie"
          unit="kcal"
          color="hsl(var(--foreground))"
          goal={profile.goal_kcal}
          values={days.map((d) => ({ label: d.label, v: d.totals.kcal }))}
          avg={avg.kcal}
        />
        <ChartCard
          title="Białko"
          unit="g"
          color="var(--protein)"
          goal={profile.goal_protein}
          values={days.map((d) => ({ label: d.label, v: d.totals.protein }))}
          avg={avg.protein}
        />
        <ChartCard
          title="Węglowodany"
          unit="g"
          color="var(--carbs)"
          goal={profile.goal_carbs}
          values={days.map((d) => ({ label: d.label, v: d.totals.carbs }))}
          avg={avg.carbs}
        />
        <ChartCard
          title="Tłuszcz"
          unit="g"
          color="var(--fat)"
          goal={profile.goal_fat}
          values={days.map((d) => ({ label: d.label, v: d.totals.fat }))}
          avg={avg.fat}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="num-tight mt-0.5 text-xl font-bold">{value}</div>
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
    <div className="rounded-3xl bg-card p-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {title}
          </div>
          <div className="num-tight mt-0.5 text-lg font-semibold">
            śr. {Math.round(avg)} {unit}
          </div>
        </div>
        <div className="num-tight text-right text-[11px] text-muted-foreground">
          cel {goal} {unit}
        </div>
      </div>

      <div className="relative mt-3 h-24">
        {/* Goal line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-foreground/30"
          style={{ bottom: `${(goal / max) * 100}%` }}
        />
        <div className="flex h-full items-end gap-[3px]">
          {values.map((d, i) => {
            const h = Math.min(100, (d.v / max) * 100);
            const hit = d.v > 0 && d.v >= goal * 0.9 && d.v <= goal * 1.1;
            return (
              <div
                key={i}
                className="group relative flex-1"
                style={{ height: "100%" }}
                title={`${d.label}: ${Math.round(d.v)} ${unit}`}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-md transition-opacity"
                  style={{
                    height: `${h}%`,
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
              className="flex-1 text-center text-[10px] text-muted-foreground"
            >
              {d.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
