import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ChevronRight, Pencil, ShoppingBag } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  type Activity,
  type GoalKind,
  type Sex,
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

const CARD: React.CSSProperties = {
  boxShadow: "var(--shadow-card)",
  border: "1px solid var(--hairline)",
  background: "var(--card)",
  borderRadius: 22,
};

const ACTIVITY_ORDER: Activity[] = ["sedentary", "light", "moderate", "high", "very_high"];
const ACTIVITY_KEY: Record<Activity, string> = {
  sedentary: "calc.activitySedentary",
  light: "calc.activityLight",
  moderate: "calc.activityModerate",
  high: "calc.activityActive",
  very_high: "calc.activityVeryActive",
};
const ACTIVITY_DESC: Record<Activity, string> = {
  sedentary: "profile.actDesc.sedentary",
  light: "profile.actDesc.light",
  moderate: "profile.actDesc.moderate",
  high: "profile.actDesc.high",
  very_high: "profile.actDesc.very_high",
};

const GOAL_ORDER: GoalKind[] = ["cut", "maintain", "bulk"];
const GOAL_KEY: Record<GoalKind, string> = {
  cut: "calc.goalCut",
  maintain: "calc.goalMaintain",
  bulk: "calc.goalBulk",
};

function ProfilePage() {
  const { t } = useTranslation();
  const p = usePlate((s) => s.profile);
  const setBody = usePlate((s) => s.setBody);
  const setGoals = usePlate((s) => s.setGoals);
  const anim = (i: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.04 * i, duration: 0.3, ease: "easeOut" as const },
  });

  const body = p.body ?? DEFAULT_BODY;
  const ready = body.age > 0 && body.height > 0 && body.weight > 0;
  const computed = useMemo(
    () => (ready ? computeGoals(body) : null),
    [body, ready]
  );

  const pK = p.goal_protein * 4;
  const cK = p.goal_carbs * 4;
  const fK = p.goal_fat * 9;
  const total = pK + cK + fK || 1;
  const pPct = (pK / total) * 100;
  const cPct = (cK / total) * 100;
  const fPct = (fK / total) * 100;

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
    <div className="pb-8">
      <ScreenHeader title={t("profile.title")} />

      <div className="px-[18px] space-y-6">
        {/* ============ TWOJE CELE ============ */}
        <section className="space-y-2">
          <SectionLabel>{t("profile.yourGoals")}</SectionLabel>
          <div className="p-4" style={CARD}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--muted-foreground)" }}>
                  {t("profile.dailyGoals")}
                </div>
                <div className="num-tight mt-1 text-[26px] leading-none" style={{ fontWeight: 800, color: "var(--ink)" }}>
                  {Math.round(p.goal_kcal)} <span className="text-[15px]" style={{ color: "var(--muted-foreground)", fontWeight: 700 }}>kcal / dzień</span>
                </div>
              </div>
              <Link
                to="/settings"
                aria-label={t("common.edit")}
                className="grid h-9 w-9 place-items-center rounded-full active:scale-95"
                style={{ background: "color-mix(in oklab, var(--ink) 6%, transparent)", color: "var(--ink)" }}
              >
                <Pencil size={16} strokeWidth={2} />
              </Link>
            </div>

            {/* Segmented macro bar */}
            <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full" style={{ background: "var(--hairline)" }}>
              <div style={{ width: `${pPct}%`, background: "var(--macro-protein)", boxShadow: "inset -1.5px 0 0 rgba(0,0,0,.35)" }} />
              <div style={{ width: `${cPct}%`, background: "var(--macro-carbs)", boxShadow: "inset -1.5px 0 0 rgba(0,0,0,.35)" }} />
              <div style={{ width: `${fPct}%`, background: "var(--macro-fat)" }} />
            </div>

            <ul className="mt-3 grid grid-cols-3 gap-2">
              <MacroCell label={t("macro.protein")} g={p.goal_protein} color="var(--macro-protein)" />
              <MacroCell label={t("macro.carbs")} g={p.goal_carbs} color="var(--macro-carbs)" />
              <MacroCell label={t("macro.fat")} g={p.goal_fat} color="var(--macro-fat)" />
            </ul>
          </div>

          {/* Library row */}
          <Link to="/products" className="flex items-center gap-3 p-3" style={CARD}>
            <div
              className="grid h-10 w-10 place-items-center rounded-xl"
              style={{ background: "color-mix(in oklab, var(--ink) 6%, transparent)", color: "var(--ink)" }}
            >
              <ShoppingBag size={18} strokeWidth={2} />
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--muted-foreground)" }}>
                {t("profile.library")}
              </div>
              <div className="mt-0.5 text-[15px]" style={{ fontWeight: 700, color: "var(--ink)" }}>
                {t("profile.myProducts")}
              </div>
            </div>
            <ChevronRight size={18} style={{ color: "var(--muted-foreground)" }} />
          </Link>
        </section>

        {/* ============ PROFIL CIAŁA ============ */}
        <section className="space-y-2">
          <SectionLabel>{t("profile.bodyProfile")}</SectionLabel>

          {/* Card A: Sex + Age/Height/Weight */}
          <div className="p-4 space-y-3" style={CARD}>
            <Seg
              label={t("calc.sex")}
              value={body.sex}
              onChange={(v) => setBody({ sex: v })}
              options={[
                { v: "female", l: t("calc.sexFemale") },
                { v: "male", l: t("calc.sexMale") },
              ]}
            />
            <div className="grid grid-cols-3 gap-2">
              <NumField label={t("calc.age")} unit={t("calc.ageUnit")} value={body.age} onChange={(v) => setBody({ age: v })} />
              <NumField label={t("calc.height")} unit="cm" value={body.height} onChange={(v) => setBody({ height: v })} />
              <NumField label={t("calc.weight")} unit="kg" value={body.weight} onChange={(v) => setBody({ weight: v })} />
            </div>
          </div>

          {/* Card B: Activity (vertical list) */}
          <div className="p-4 space-y-2" style={CARD}>
            <FieldLabel>{t("calc.activity")}</FieldLabel>
            <div className="space-y-1.5">
              {ACTIVITY_ORDER.map((k) => (
                <ActivityRow
                  key={k}
                  active={body.activity === k}
                  title={t(ACTIVITY_KEY[k])}
                  desc={t(ACTIVITY_DESC[k])}
                  onClick={() => setBody({ activity: k })}
                />
              ))}
            </div>
          </div>

          {/* Card C: Goal */}
          <div className="p-4 space-y-2" style={CARD}>
            <Seg
              label={t("calc.goal")}
              value={body.goal}
              onChange={(v) => setBody({ goal: v })}
              options={GOAL_ORDER.map((k) => ({ v: k, l: t(GOAL_KEY[k]) }))}
            />
          </div>
        </section>

        {/* ============ KALKULATOR BMR / TDEE ============ */}
        <section className="space-y-2">
          <SectionLabel>{t("calc.title")}</SectionLabel>

          <div className="p-4 space-y-3" style={CARD}>
            {!computed ? (
              <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                {t("profile.needMore")}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label={t("calc.bmr")} value={`${computed.bmr} kcal`} />
                  <Stat label={t("calc.tdee")} value={`${computed.tdee} kcal`} />
                </div>

                <div
                  className="rounded-2xl p-3"
                  style={{
                    background: "rgba(244,181,0,.14)",
                    border: "1px solid rgba(244,181,0,.40)",
                  }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--muted-foreground)" }}>
                    {t("profile.suggestedGoal")}
                  </div>
                  <div className="num-tight mt-0.5 text-[24px] leading-none" style={{ fontWeight: 800, color: "var(--ink)" }}>
                    {computed.kcal} kcal
                  </div>
                  <div className="num-tight mt-1.5 text-[12px]" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>
                    {t("macro.short.protein")} {computed.protein} g · {t("macro.short.carbs")} {computed.carbs} g · {t("macro.short.fat")} {computed.fat} g
                  </div>
                </div>

                <button
                  onClick={applyComputed}
                  className="w-full rounded-full px-4 py-3.5 text-[14px] active:scale-[0.99]"
                  style={{ background: "var(--accent-yellow)", color: "#161616", fontWeight: 800 }}
                >
                  {t("profile.setAsDaily")}
                </button>
                <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  {t("profile.willOverride")}
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-1 text-[10px] font-semibold uppercase tracking-[0.10em]"
      style={{ color: "var(--muted-foreground)" }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] font-semibold uppercase tracking-[0.06em]"
      style={{ color: "var(--muted-foreground)" }}
    >
      {children}
    </div>
  );
}

function MacroCell({ label, g, color }: { label: string; g: number; color: string }) {
  return (
    <li
      className="rounded-2xl px-2 py-2"
      style={{ background: "color-mix(in oklab, var(--ink) 4%, transparent)" }}
    >
      <div className="flex items-center justify-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[11px]" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>{label}</span>
      </div>
      <div className="num-tight mt-0.5 text-center text-[15px]" style={{ color: "var(--ink)", fontWeight: 800 }}>
        {g} <span className="text-[11px]" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>g</span>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl px-3 py-2.5"
      style={{ background: "color-mix(in oklab, var(--ink) 4%, transparent)" }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </div>
      <div className="num-tight mt-0.5 text-[16px]" style={{ color: "var(--ink)", fontWeight: 800 }}>{value}</div>
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
    <label
      className="block rounded-2xl px-3 py-2"
      style={{ background: "color-mix(in oklab, var(--ink) 4%, transparent)" }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--muted-foreground)" }}>
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
          className="num-tight w-full bg-transparent text-[18px] outline-none"
          style={{ color: "var(--ink)", fontWeight: 800 }}
        />
        <span className="text-[11px]" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>{unit}</span>
      </div>
    </label>
  );
}

function ActivityRow({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.99]"
      style={{
        background: active ? "rgba(244,181,0,.14)" : "color-mix(in oklab, var(--ink) 3%, transparent)",
        border: `1px solid ${active ? "rgba(244,181,0,.40)" : "transparent"}`,
      }}
    >
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
        style={{
          border: `2px solid ${active ? "var(--accent-yellow)" : "var(--muted-foreground)"}`,
          opacity: active ? 1 : 0.5,
        }}
      >
        {active && (
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent-yellow)" }} />
        )}
      </span>
      <span className="flex-1">
        <span className="block text-[13px]" style={{ color: "var(--ink)", fontWeight: 700 }}>
          {title}
        </span>
        <span className="block text-[11px]" style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>
          {desc}
        </span>
      </span>
    </button>
  );
}

function Seg<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { v: T; l: string }[];
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        className="mt-1.5 flex gap-1 rounded-full p-1"
        style={{ background: "color-mix(in oklab, var(--ink) 5%, transparent)" }}
      >
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              onClick={() => onChange(o.v)}
              className="flex-1 rounded-full px-3 py-1.5 text-[12px] transition active:scale-[0.98]"
              style={{
                background: active ? "var(--ink)" : "transparent",
                color: active ? "var(--card)" : "var(--muted-foreground)",
                fontWeight: active ? 800 : 600,
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
