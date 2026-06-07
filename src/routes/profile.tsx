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

const CARD: React.CSSProperties = { boxShadow: "var(--shadow-card)" };

function ProfilePage() {
  const p = usePlate((s) => s.profile);
  const setBody = usePlate((s) => s.setBody);
  const setGoals = usePlate((s) => s.setGoals);

  const body = p.body ?? DEFAULT_BODY;
  const ready = body.age > 0 && body.height > 0 && body.weight > 0;
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
    <div className="pb-4">
      <ScreenHeader title="Profil" />

      <div className="px-[18px] space-y-3">
        <Link to="/settings" className="flex items-center gap-3 rounded-[24px] bg-card p-4" style={CARD}>
          <div className="flex-1">
            <div className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
              Cele dzienne
            </div>
            <div className="num-tight mt-1 text-[17px]" style={{ fontWeight: 800, color: "var(--ink)" }}>
              {Math.round(p.goal_kcal)} kcal · B {p.goal_protein} · W {p.goal_carbs} · T {p.goal_fat}
            </div>
          </div>
          <ChevronRight size={20} style={{ color: "var(--muted-foreground)" }} />
        </Link>

        <Link to="/products" className="flex items-center gap-3 rounded-[24px] bg-card p-4" style={CARD}>
          <div className="flex-1">
            <div className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
              Biblioteka
            </div>
            <div className="mt-1 text-[17px]" style={{ fontWeight: 800, color: "var(--ink)" }}>Moje produkty</div>
          </div>
          <ChevronRight size={20} style={{ color: "var(--muted-foreground)" }} />
        </Link>

        <div className="rounded-[24px] bg-card p-4" style={CARD}>
          <div className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
            Rozkład makro
          </div>
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--hairline)" }}>
            <div style={{ width: `${pct(pK)}%`, background: "var(--macro-protein)" }} />
            <div style={{ width: `${pct(cK)}%`, background: "var(--macro-carbs)" }} />
            <div style={{ width: `${pct(fK)}%`, background: "var(--macro-fat)" }} />
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MacroCell label="Białko" g={p.goal_protein} color="var(--macro-protein)" />
            <MacroCell label="Węglowodany" g={p.goal_carbs} color="var(--macro-carbs)" />
            <MacroCell label="Tłuszcz" g={p.goal_fat} color="var(--macro-fat)" />
          </ul>
        </div>

        <section className="space-y-3 rounded-[24px] bg-card p-4" style={CARD}>
          <h2 className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
            Profil ciała
          </h2>

          <Seg label="Płeć" value={body.sex} onChange={(v) => setBody({ sex: v })}
            options={[{ v: "female", l: "Kobieta" }, { v: "male", l: "Mężczyzna" }]} />

          <div className="grid grid-cols-3 gap-2">
            <NumField label="Wiek" unit="lat" value={body.age} onChange={(v) => setBody({ age: v })} />
            <NumField label="Wzrost" unit="cm" value={body.height} onChange={(v) => setBody({ height: v })} />
            <NumField label="Waga" unit="kg" value={body.weight} onChange={(v) => setBody({ weight: v })} />
          </div>

          <Seg
            label="Aktywność"
            value={body.activity}
            onChange={(v) => setBody({ activity: v })}
            options={(Object.keys(ACTIVITY_LABEL) as Activity[]).map((k) => ({ v: k, l: ACTIVITY_LABEL[k] }))}
            small
          />

          <Seg
            label="Cel"
            value={body.goal}
            onChange={(v) => setBody({ goal: v })}
            options={(Object.keys(GOAL_LABEL) as GoalKind[]).map((k) => ({ v: k, l: GOAL_LABEL[k] }))}
          />
        </section>

        <section className="space-y-3 rounded-[24px] bg-card p-4" style={CARD}>
          <h2 className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
            Kalkulator celów
          </h2>

          {!computed ? (
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Uzupełnij wiek, wzrost i wagę, aby obliczyć sugerowane cele.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="BMR" value={`${computed.bmr} kcal`} />
                <Stat label="TDEE" value={`${computed.tdee} kcal`} />
              </div>
              <div className="rounded-2xl p-3" style={{ background: "var(--hairline)" }}>
                <div className="num-tight text-[22px]" style={{ fontWeight: 800, color: "var(--ink)" }}>
                  {computed.kcal} kcal
                </div>
                <div className="num-tight mt-1 text-[13px]" style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>
                  B {computed.protein} g · W {computed.carbs} g · T {computed.fat} g
                </div>
              </div>
              <button
                onClick={applyComputed}
                className="w-full rounded-full px-4 py-3.5 text-[14px] active:scale-[0.99]"
                style={{ background: "#1B1B19", color: "#FBF4E2", fontWeight: 700 }}
              >
                Ustaw jako moje cele
              </button>
              <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                Możesz je później ręcznie edytować w Ustawieniach.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function MacroCell({ label, g, color }: { label: string; g: number; color: string }) {
  return (
    <li className="rounded-2xl px-2 py-2" style={{ background: "var(--hairline)" }}>
      <div className="flex items-center justify-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[11px]" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>{label}</span>
      </div>
      <div className="num-tight mt-0.5 text-[14px]" style={{ color: "var(--ink)", fontWeight: 700 }}>
        {g} g
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-3 py-2" style={{ background: "var(--hairline)" }}>
      <div className="text-[10px]" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>
        {label}
      </div>
      <div className="num-tight mt-0.5 text-[14px]" style={{ color: "var(--ink)", fontWeight: 700 }}>{value}</div>
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
    <label className="block rounded-2xl px-3 py-2" style={{ background: "var(--hairline)" }}>
      <div className="text-[10px]" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>
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
          className="num-tight w-full bg-transparent text-[16px] outline-none"
          style={{ color: "var(--ink)", fontWeight: 700 }}
        />
        <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{unit}</span>
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
      <div className="mb-1.5 text-[10px]" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1 rounded-full p-0.5" style={{ background: "var(--hairline)" }}>
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              onClick={() => onChange(o.v)}
              className={`flex-1 rounded-full px-3 py-1.5 ${small ? "text-[11px]" : "text-xs"} transition`}
              style={{
                background: active ? "#1B1B19" : "transparent",
                color: active ? "#FBF4E2" : "var(--muted-foreground)",
                fontWeight: active ? 700 : 600,
              }}
            >
              {o.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
