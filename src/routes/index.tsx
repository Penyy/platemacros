import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, User, Flame, ChevronLeft, ChevronRight } from "lucide-react";
import { MealCard } from "@/components/MealCard";
import { NotificationsSheet, startNotificationScheduler } from "@/components/NotificationsSheet";
import { BurnedEditSheet } from "@/components/BurnedEditSheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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

const WEEKDAY_LABEL = [
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
  "Niedziela",
];

function polishDate(d: Date) {
  const wd = WEEKDAY_LABEL[(d.getDay() + 6) % 7];
  const day = d.getDate();
  const months = [
    "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
    "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
  ];
  return `${wd}, ${day} ${months[d.getMonth()]}`;
}

function TodayPage() {
  const today = useMemo(() => ymd(new Date()), []);
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

  const shiftDay = (delta: number) => {
    const d = new Date(selected + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setSelected(ymd(d));
  };

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
  const burned = Math.round(burnedMap[selected] ?? 0);
  const adjustedGoal = Math.round(
    profile.include_burned ? dayGoals.kcal + burned : dayGoals.kcal
  );
  const remaining = Math.max(0, Math.round(adjustedGoal - sum.kcal));

  const dateLabel = polishDate(new Date(selected + "T00:00:00"));
  const isToday = selected === today;

  return (
    <div className="space-y-3.5 pb-4">
      {/* Top bar */}
      <header className="flex items-center justify-between px-[18px] pt-[max(env(safe-area-inset-top),1rem)]">
        <Logo />
        <div className="flex items-center gap-2">
          <IconCircle aria-label="Powiadomienia" onClick={() => setNotifOpen(true)}>
            <Bell size={18} strokeWidth={1.8} />
          </IconCircle>
          <LinkCircle to="/profile" aria-label="Profil"><User size={18} strokeWidth={1.8} /></LinkCircle>
        </div>

      </header>

      {/* Day navigator */}
      <section className="flex items-center justify-between gap-2 px-[18px]">
        <button
          onClick={() => shiftDay(-1)}
          aria-label="Poprzedni dzień"
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
              disabled={(d) => d > new Date()}
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
              Dziś
            </button>
          )}
          <button
            onClick={() => shiftDay(1)}
            aria-label="Następny dzień"
            disabled={isToday}
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
              prevDayHasEntries={prevEntries.some((e) => e.meal === m)}
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
        className="text-[24px] font-extrabold tracking-tight"
        style={{ color: "var(--ink)", letterSpacing: "-0.04em" }}
      >
        plate
      </span>
      <span
        className="text-[24px] font-extrabold"
        style={{ color: "var(--ink)" }}
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden p-5"
      style={{
        background: "var(--cream)",
        borderRadius: 28,
        color: "var(--ink)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="relative grid place-items-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
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
            stroke="#F4B500"
            strokeWidth={stroke}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${pct} 1`}
            style={{
              strokeDashoffset: 0,
              filter: "blur(8px)",
              opacity: 0.7,
              transition: "stroke-dasharray 0.65s cubic-bezier(0.22,1,0.36,1)",
            }}
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
            z {goal} kcal
          </div>
          <div
            className="mt-3 rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{
              background: "color-mix(in oklab, var(--ink) 8%, transparent)",
              color: "var(--ink)",
            }}
          >
            Pozostało {remaining}
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
        aria-label="Edytuj spalone kalorie"
      >
        <Flame size={12} strokeWidth={1.8} />
        <span className="num-tight font-semibold">Spalone {burned}</span>
      </button>

      {/* Macros — three slim bars */}
      <div className="mt-4 space-y-3">
        <LightMacroRow label="Białko" cur={protein.cur} goal={protein.goal} color="var(--macro-protein)" />
        <LightMacroRow label="Węglowodany" cur={carbs.cur} goal={carbs.goal} color="var(--macro-carbs)" />
        <LightMacroRow label="Tłuszcz" cur={fat.cur} goal={fat.goal} color="var(--macro-fat)" />
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
