import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, User, Flame, ChevronLeft, ChevronRight, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MealCard } from "@/components/MealCard";
import { NotificationsSheet, startNotificationScheduler } from "@/components/NotificationsSheet";
import { BurnedEditSheet } from "@/components/BurnedEditSheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  type Meal,
  countMissingFromPrevDay,
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

function useLocalizedDate() {
  const { i18n } = useTranslation();
  return (d: Date) => {
    const locale = i18n.language?.startsWith("en") ? "en-US" : "pl-PL";
    const s = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(d);
    return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  };
}


function TodayPage() {
  const { t } = useTranslation();
  const formatDate = useLocalizedDate();
  const today = useMemo(() => ymd(new Date()), []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return ymd(d);
  }, []);
  const [selected, setSelected] = useState<string>(today);
  const [calOpen, setCalOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [burnedOpen, setBurnedOpen] = useState(false);

  useEffect(() => {
    startNotificationScheduler();
  }, []);


  const profile = usePlate((s) => s.profile);
  const entries = usePlate((s) => s.entries);
  const burnedMap = usePlate((s) => s.burned);
  const openAdd = usePlate((s) => s.openAdd);
  const dayOffs = usePlate((s) => s.dayOffs);
  const removeDayOff = usePlate((s) => s.removeDayOff);
  const isDayOffSelected = dayOffs.has(selected);

  const shiftDay = (delta: number) => {
    const d = new Date(selected + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setSelected(ymd(d));
  };

  const dayEntries = useMemo(
    () => entries.filter((e) => e.date === selected),
    [entries, selected]
  );
  const missingPrev = useMemo(() => {
    const out: Record<Meal, boolean> = {} as Record<Meal, boolean>;
    for (const m of MEALS) {
      out[m] = countMissingFromPrevDay(entries, selected, m) > 0;
    }
    return out;
  }, [entries, selected]);
  const sum = useMemo(() => sumEntries(dayEntries), [dayEntries]);
  const dayGoals = useMemo(() => getDayGoals(profile, selected), [profile, selected]);
  const burned = Math.round(burnedMap[selected] ?? 0);
  const adjustedGoal = Math.round(
    profile.include_burned ? dayGoals.kcal + burned : dayGoals.kcal
  );
  const remaining = Math.max(0, Math.round(adjustedGoal - sum.kcal));

  const dateLabel = formatDate(new Date(selected + "T00:00:00"));
  const isToday = selected === today;
  const isMaxDay = selected === tomorrow;

  return (
    <div className="space-y-3.5 pb-4">
      {/* Top bar */}
      <header className="flex items-center justify-between px-[18px] pt-[max(env(safe-area-inset-top),1rem)]">
        <Logo />
        <div className="flex items-center gap-2">
          <IconCircle aria-label={t("a11y.notifications")} onClick={() => setNotifOpen(true)}>
            <Bell size={20} strokeWidth={2} />
          </IconCircle>
          <LinkCircle to="/profile" aria-label={t("a11y.profile")}><User size={20} strokeWidth={2} /></LinkCircle>
        </div>


      </header>

      {/* Day navigator */}
      <section className="flex items-center justify-between gap-2 px-[18px]">
        <button
          onClick={() => shiftDay(-1)}
          aria-label={t("today.prevDay")}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground active:scale-95"
        >
          <ChevronLeft size={18} />
        </button>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button className="flex-1 text-center text-sm font-semibold text-foreground active:opacity-70">
              {dateLabel}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={new Date(selected + "T00:00:00")}
              onSelect={(d) => {
                if (d) {
                  setSelected(ymd(d));
                  setCalOpen(false);
                }
              }}
              disabled={(d) => ymd(d) > tomorrow}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-1">
          {!isToday && (
            <button
              onClick={() => setSelected(today)}
              className="rounded-full bg-foreground/5 px-2.5 py-1 text-[11px] font-semibold text-foreground active:scale-95"
            >
              {t("common.today")}
            </button>
          )}
          <button
            onClick={() => shiftDay(1)}
            aria-label={t("today.nextDay")}
            disabled={isMaxDay}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground active:scale-95 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {/* Light hero: kcal ring + macros */}
      <section className="px-[18px]">
        <HeroLight
          consumed={Math.round(sum.kcal)}
          goal={Math.max(1, Math.round(adjustedGoal))}
          remaining={remaining}
          burned={burned}
          onEditBurned={() => setBurnedOpen(true)}
          protein={{ cur: Math.round(sum.protein), goal: dayGoals.protein }}
          carbs={{ cur: Math.round(sum.carbs), goal: dayGoals.carbs }}
          fat={{ cur: Math.round(sum.fat), goal: dayGoals.fat }}
        />
      </section>


      {/* Meals */}
      <section className="space-y-3 px-[18px]">
        {MEALS.map((m, i) => (
          <motion.div
            key={m}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.3, ease: "easeOut" }}
          >
            <MealCard
              meal={m}
              date={selected}
              entries={dayEntries.filter((e) => e.meal === m)}
              prevDayHasEntries={missingPrev[m]}
              onAdd={(meal) => openAdd(meal, selected)}
            />
          </motion.div>
        ))}
      </section>

      <NotificationsSheet open={notifOpen} onOpenChange={setNotifOpen} />
      <BurnedEditSheet open={burnedOpen} date={selected} onOpenChange={setBurnedOpen} />
    </div>
  );
}



/* ---------- Subcomponents ---------- */

function Logo() {
  return (
    <div className="flex items-baseline">
      <span
        className="text-[28px] font-extrabold tracking-tight"
        style={{ color: "var(--ink)", letterSpacing: "-0.04em" }}
      >
        plate
      </span>
      <span
        className="text-[28px] font-extrabold"
        style={{ color: "var(--accent-yellow)", letterSpacing: "-0.04em" }}
      >
        .
      </span>
    </div>
  );
}

function IconCircle({
  children,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  onClick?: () => void;
  "aria-label"?: string;
}) {
  return (
    <button
      {...rest}
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-full bg-card text-foreground"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </button>
  );
}


function LinkCircle({ to, children, ...rest }: { to: string; children: React.ReactNode; "aria-label"?: string }) {
  return (
    <a
      href={to}
      {...rest}
      className="grid h-10 w-10 place-items-center rounded-full bg-card text-foreground"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </a>
  );
}

function HeroLight({
  consumed,
  goal,
  remaining,
  burned,
  onEditBurned,
  protein,
  carbs,
  fat,
}: {
  consumed: number;
  goal: number;
  remaining: number;
  burned: number;
  onEditBurned: () => void;
  protein: { cur: number; goal: number };
  carbs: { cur: number; goal: number };
  fat: { cur: number; goal: number };
}) {
  const size = 230;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const pct = Math.max(0, Math.min(1, consumed / goal));
  const startAngle = -135;
  const totalArc = 270;
  const trackPath = describeArc(cx, cy, r, startAngle, startAngle + totalArc);

  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden p-5"
      style={{
        background: "var(--hero-bg)",
        borderRadius: 28,
        color: "var(--ink)",
        boxShadow: "var(--shadow-card)",
        
      }}
    >
      <div className="relative grid place-items-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <path
            d={trackPath}
            fill="none"
            stroke="var(--hairline)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={trackPath}
            fill="none"
            stroke="var(--accent-yellow)"
            strokeWidth={stroke}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${pct} 1`}
            style={{
              strokeDashoffset: 0,
              transition: "stroke-dasharray 0.65s cubic-bezier(0.22,1,0.36,1)",
            }}
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="num-tight text-[44px] font-extrabold leading-none tracking-tight"
            style={{ color: "var(--ink)" }}
          >
            {consumed}
          </div>
          <div className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            {t("today.ofKcal", { goal })}
          </div>
          <div
            className="mt-3 rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{
              background: "color-mix(in oklab, var(--ink) 8%, transparent)",
              color: "var(--ink)",
            }}
          >
            {consumed > goal
              ? t("today.over", { n: Math.round(consumed - goal) })
              : t("today.left", { n: remaining })}
          </div>
        </div>
      </div>

      {/* Spalone — tap to edit */}
      <button
        onClick={onEditBurned}
        className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] active:scale-95"
        style={{
          color: "var(--muted-foreground)",
          background: "color-mix(in oklab, var(--ink) 5%, transparent)",
        }}
        aria-label={t("today.editBurned")}
      >
        <Flame size={12} strokeWidth={1.8} />
        <span className="num-tight font-semibold">{t("today.burned", { n: burned })}</span>
      </button>

      {/* Macros — three slim bars */}
      <div className="mt-4 space-y-3">
        <LightMacroRow label={t("macro.protein")} cur={protein.cur} goal={protein.goal} color="var(--macro-protein)" />
        <LightMacroRow label={t("macro.carbs")} cur={carbs.cur} goal={carbs.goal} color="var(--macro-carbs)" />
        <LightMacroRow label={t("macro.fat")} cur={fat.cur} goal={fat.goal} color="var(--macro-fat)" />
      </div>
    </motion.div>
  );
}


function LightMacroRow({
  label,
  cur,
  goal,
  color,
}: {
  label: string;
  cur: number;
  goal: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(1, goal > 0 ? cur / goal : 0));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
          {label}
        </span>
        <span className="num-tight text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
          <span>{cur}</span>
          <span style={{ color: "var(--muted-foreground)" }}> / {goal} g</span>
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--hairline)" }}
      >
        <motion.div
          className="h-full rounded-full"
          initial={false}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ background: color }}
        />
      </div>
    </div>
  );
}


function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";
  return ["M", start.x, start.y, "A", r, r, 0, largeArcFlag, 1, end.x, end.y].join(" ");
}
