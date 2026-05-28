import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  type Activity,
  type GoalKind,
  type Sex,
  ACTIVITY_LABEL,
  GOAL_LABEL,
  computeGoals,
  usePlate,
} from "@/lib/store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Plate — Profil" },
      { name: "description", content: "Twoje cele i rozkład makroskładników." },
    ],
  }),
  component: ProfilePage,
});

const DEFAULT_BODY = {
  sex: "female" as Sex,
  age: 30,
  height: 170,
  weight: 70,
  activity: "moderate" as Activity,
  goal: "maintain" as GoalKind,
};

function ProfilePage() {
  const p = usePlate((s) => s.profile);
  const setBody = usePlate((s) => s.setBody);
  const setGoals = usePlate((s) => s.setGoals);

  const body = p.body ?? DEFAULT_BODY;
  const ready =
    body.age > 0 && body.height > 0 && body.weight > 0;
  const computed = useMemo(
    () => (ready ? computeGoals(body) : null),
    [body, ready]
  );

  const pK = p.goal_protein * 4;
  const cK = p.goal_carbs * 4;
  const fK = p.goal_fat * 9;
  const total = pK + cK + fK;
  const pct = (k: number) => (total ? Math.round((k / total) * 100) : 0);

  function applyComputed() {
    if (!computed) return;
    setGoals({
      goal_kcal: computed.kcal,
      goal_protein: computed.protein,
      goal_carbs: computed.carbs,
      goal_fat: computed.fat,
    });
  }

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
            <div style={{ width: `${pct(pK)}%`, background: "var(--protein)" }} />
            <div style={{ width: `${pct(cK)}%`, background: "var(--carbs)" }} />
            <div style={{ width: `${pct(fK)}%`, background: "var(--fat)" }} />
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Row label="Białko" g={p.goal_protein} pct={pct(pK)} color="var(--protein)" />
            <Row label="Węgle" g={p.goal_carbs} pct={pct(cK)} color="var(--carbs)" />
            <Row label="Tłuszcz" g={p.goal_fat} pct={pct(fK)} color="var(--fat)" />
          </ul>
        </div>

        <section className="rounded-3xl bg-card p-4 space-y-3">
          <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Profil ciała
          </h2>

          <Seg
            label="Płeć"
            value={body.sex}
            onChange={(v) => setBody({ sex: v })}
            options={[
              { v: "female", l: "Kobieta" },
              { v: "male", l: "Mężczyzna" },
            ]}
          />

          <div className="grid grid-cols-3 gap-2">
            <NumField
              label="Wiek"
              unit="lat"
              value={body.age}
              onChange={(v) => setBody({ age: v })}
            />
            <NumField
              label="Wzrost"
              unit="cm"
              value={body.height}
              onChange={(v) => setBody({ height: v })}
            />
            <NumField
              label="Waga"
              unit="kg"
              value={body.weight}
              onChange={(v) => setBody({ weight: v })}
            />
          </div>

          <Seg
            label="Aktywność"
            value={body.activity}
            onChange={(v) => setBody({ activity: v })}
            options={(Object.keys(ACTIVITY_LABEL) as Activity[]).map((k) => ({
              v: k,
              l: ACTIVITY_LABEL[k],
            }))}
            small
          />

          <Seg
            label="Cel"
            value={body.goal}
            onChange={(v) => setBody({ goal: v })}
            options={(Object.keys(GOAL_LABEL) as GoalKind[]).map((k) => ({
              v: k,
              l: GOAL_LABEL[k],
            }))}
          />
        </section>

        <section className="rounded-3xl bg-card p-4 space-y-3">
          <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Kalkulator celów
          </h2>

          {!computed ? (
            <p className="text-sm text-muted-foreground">
              Uzupełnij wiek, wzrost i wagę, aby obliczyć sugerowane cele.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="BMR" value={`${computed.bmr} kcal`} />
                <Stat label="TDEE" value={`${computed.tdee} kcal`} />
              </div>
              <div className="rounded-2xl bg-foreground/5 p-3">
                <div className="num-tight text-2xl font-semibold">
                  {computed.kcal} kcal
                </div>
                <div className="num-tight mt-1 text-sm text-muted-foreground">
                  B {computed.protein} g · W {computed.carbs} g · T{" "}
                  {computed.fat} g
                </div>
              </div>
              <button
                onClick={applyComputed}
                className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground active:opacity-90"
              >
                Ustaw jako moje cele
              </button>
              <p className="text-[11px] text-muted-foreground">
                Możesz je później ręcznie edytować w Ustawieniach.
              </p>
            </>
          )}
        </section>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-foreground/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="num-tight mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

function NumField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-2xl bg-foreground/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <input
          inputMode="numeric"
          value={value || ""}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^\d]/g, ""));
            onChange(Number.isNaN(n) ? 0 : n);
          }}
          className="num-tight w-full bg-transparent text-base font-semibold outline-none"
        />
        <span className="text-[11px] text-muted-foreground">{unit}</span>
      </div>
    </label>
  );
}

function Seg<T extends string>({
  label,
  value,
  onChange,
  options,
  small,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { v: T; l: string }[];
  small?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1 rounded-full bg-foreground/5 p-0.5">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`flex-1 rounded-full px-3 py-1.5 ${
              small ? "text-[11px]" : "text-xs"
            } font-semibold transition ${
              value === o.v
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
