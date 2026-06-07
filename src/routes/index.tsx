import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
const Plate3D = lazy(() => import("@/components/Plate3D"));
import { MealCard } from "@/components/MealCard";
import { WeekStrip } from "@/components/WeekStrip";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  type Meal,
  getDayGoals,
  sumEntries,
  usePlate,
  ymd,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plate — Dzisiaj" },
      {
        name: "description",
        content:
          "Twój dzienny przegląd kalorii i makroskładników w jednym widoku.",
      },
    ],
  }),
  component: TodayPage,
});

const MEALS: Meal[] = ["breakfast", "second_breakfast", "lunch", "dinner", "snack"];

function formatDate(d: Date) {
  return d.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
  });
}

function titleFor(date: string) {
  const today = ymd(new Date());
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (date === today) return "Dzisiaj";
  if (date === ymd(yest)) return "Wczoraj";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("pl-PL", { weekday: "long" });
}

function TodayPage() {
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => setClientReady(true), []);
  const [selected, setSelected] = useState(() => ymd(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingBurned, setEditingBurned] = useState(false);

  const profile = usePlate((s) => s.profile);
  const entries = usePlate((s) => s.entries);
  const burnedMap = usePlate((s) => s.burned);
  const setBurned = usePlate((s) => s.setBurned);
  const openAdd = usePlate((s) => s.openAdd);

  const dayEntries = useMemo(
    () => entries.filter((e) => e.date === selected),
    [entries, selected]
  );
  const prevDate = useMemo(() => {
    const d = new Date(selected + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return ymd(d);
  }, [selected]);
  const prevEntries = useMemo(
    () => entries.filter((e) => e.date === prevDate),
    [entries, prevDate]
  );
  const sum = useMemo(() => sumEntries(dayEntries), [dayEntries]);
  const dayGoals = useMemo(() => getDayGoals(profile, selected), [profile, selected]);
  const burned = burnedMap[selected] ?? 0;
  const adjustedGoal =
    profile.include_burned ? dayGoals.kcal + burned : dayGoals.kcal;
  const remaining = adjustedGoal - sum.kcal;

  const dateLabel = formatDate(new Date(selected + "T00:00:00"));

  return (
    <div className="space-y-4">
      <ScreenHeader title={titleFor(selected)} subtitle={dateLabel} />

      <div className="px-3">
        <WeekStrip
          selected={selected}
          onSelect={setSelected}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
        />
      </div>


      <section className="px-4 py-2">
        {clientReady ? (
          <Suspense fallback={<div className="h-[320px]" />}>
            <Plate3D
              entries={dayEntries}
              dayKey={selected}
              remainingKcal={remaining}
              goalKcal={adjustedGoal}
              consumedKcal={sum.kcal}
            />
          </Suspense>
        ) : (
          <div className="h-[320px]" />
        )}
        <Legend
          protein={sum.protein}
          carbs={sum.carbs}
          fat={sum.fat}
          goalP={dayGoals.protein}
          goalC={dayGoals.carbs}
          goalF={dayGoals.fat}
        />
        <BurnedRow
          value={burned}
          editing={editingBurned}
          setEditing={setEditingBurned}
          onChange={(v) => setBurned(selected, v)}
          included={!!profile.include_burned}
        />
      </section>

      <section className="space-y-3 px-3">
        {MEALS.map((m) => (
          <MealCard
            key={m}
            meal={m}
            date={selected}
            entries={dayEntries.filter((e) => e.meal === m)}
            prevDayHasEntries={prevEntries.some((e) => e.meal === m)}
            onAdd={(meal) => openAdd(meal)}
          />
        ))}
      </section>
    </div>
  );
}

function Legend({
  protein,
  carbs,
  fat,
  goalP,
  goalC,
  goalF,
}: {
  protein: number;
  carbs: number;
  fat: number;
  goalP: number;
  goalC: number;
  goalF: number;
}) {
  const items: { label: string; color: string; v: number; g: number }[] = [
    { label: "Białko", color: "var(--protein)", v: protein, g: goalP },
    { label: "Węgle", color: "var(--carbs)", v: carbs, g: goalC },
    { label: "Tłuszcz", color: "var(--fat)", v: fat, g: goalF },
  ];
  return (
    <ul className="mt-4 grid grid-cols-3 gap-2">
      {items.map((it) => (
        <li
          key={it.label}
          className="flex flex-col items-center rounded-2xl bg-card/60 px-2 py-2 text-center"
        >
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: it.color }}
            />
            <span className="text-[11px] font-medium text-muted-foreground">
              {it.label}
            </span>
          </div>
          <div className="num-tight mt-0.5 text-sm">
            <span className="font-semibold">{Math.round(it.v)}</span>
            <span className="text-muted-foreground">/{it.g} g</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function BurnedRow({
  value,
  editing,
  setEditing,
  onChange,
  included,
}: {
  value: number;
  editing: boolean;
  setEditing: (b: boolean) => void;
  onChange: (v: number) => void;
  included: boolean;
}) {
  return (
    <div className="mt-3 rounded-2xl bg-card/60">
      <button
        onClick={() => setEditing(!editing)}
        className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-foreground/5 transition rounded-2xl"
      >
        <div className="flex flex-col">
          <span className="text-[13px] font-medium">Spalone kcal</span>
          <span className="text-[11px] text-muted-foreground">
            {included ? "doliczane do celu" : "tylko informacyjnie"}
          </span>
        </div>
        <div className="num-tight text-sm">
          {value > 0 ? (
            <>
              <span className="font-semibold">{value}</span>
              <span className="text-muted-foreground"> kcal</span>
            </>
          ) : (
            <span className="text-muted-foreground">dodaj</span>
          )}
        </div>
      </button>
      {editing && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <input
            autoFocus
            inputMode="numeric"
            value={value || ""}
            placeholder="0"
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^\d]/g, ""));
              onChange(Number.isNaN(n) ? 0 : n);
            }}
            className="num-tight flex-1 rounded-lg bg-foreground/5 px-3 py-2 text-right text-[15px] font-semibold outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">kcal</span>
          <button
            onClick={() => setEditing(false)}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Gotowe
          </button>
        </div>
      )}
    </div>
  );
}
