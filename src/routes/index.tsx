import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, Settings as Cog, User, Camera, ArrowUp, ArrowUpRight, Flame, Activity, UtensilsCrossed } from "lucide-react";
import { MealCard } from "@/components/MealCard";
import {
  type Meal,
  getDayGoals,
  sumEntries,
  usePlate,
  ymd,
} from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

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
  const [selected] = useState(() => ymd(new Date()));
  const [userName, setUserName] = useState<string>("");
  const [openAssistant, setOpenAssistant] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const candidates = [
        meta.full_name,
        meta.name,
        meta.given_name,
        meta.first_name,
        data.user?.email?.split("@")[0],
      ];
      const found = candidates.find(
        (x): x is string => typeof x === "string" && x.trim().length > 0
      );
      if (found) {
        const first = String(found).split(/[\s.]+/)[0];
        setUserName(first.charAt(0).toUpperCase() + first.slice(1));
      }
    });
  }, []);

  const profile = usePlate((s) => s.profile);
  const entries = usePlate((s) => s.entries);
  const burnedMap = usePlate((s) => s.burned);
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
  const burned = Math.round(burnedMap[selected] ?? 0);
  const adjustedGoal = Math.round(
    profile.include_burned ? dayGoals.kcal + burned : dayGoals.kcal
  );
  const remaining = Math.max(0, Math.round(adjustedGoal - sum.kcal));

  const dateLabel = polishDate(new Date(selected + "T00:00:00"));

  return (
    <div className="space-y-3.5 pb-4">
      {/* Top bar */}
      <header className="flex items-center justify-between px-[18px] pt-[max(env(safe-area-inset-top),1rem)]">
        <Logo />
        <div className="flex items-center gap-2">
          <IconCircle aria-label="Powiadomienia"><Bell size={18} strokeWidth={1.8} /></IconCircle>
          <LinkCircle to="/settings" aria-label="Ustawienia"><Cog size={18} strokeWidth={1.8} /></LinkCircle>
          <LinkCircle to="/profile" aria-label="Profil"><User size={18} strokeWidth={1.8} /></LinkCircle>
        </div>
      </header>

      {/* Greeting */}
      <section className="px-[18px]">
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-tight text-foreground">
          Cześć{userName ? `, ${userName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
      </section>

      {/* Three stats */}
      <section className="px-[18px]">
        <div className="flex items-stretch rounded-[20px] bg-transparent">
          <StatCol icon={UtensilsCrossed} label="Zjedzone" value={Math.round(sum.kcal)} />
          <Divider />
          <StatCol icon={Activity} label="Pozostało" value={remaining} />
          <Divider />
          <StatCol icon={Flame} label="Spalone" value={burned} />
        </div>
      </section>

      {/* Plate dial hero */}
      <section className="px-[18px]">
        <PlateDial
          consumed={Math.round(sum.kcal)}
          goal={Math.max(1, Math.round(adjustedGoal))}
        />
      </section>

      {/* Macros */}
      <section className="px-[18px]">
        <div className="surface-card p-4">
          <h2 className="text-[17px] font-bold tracking-tight">Makra</h2>
          <div className="mt-3 space-y-3.5">
            <MacroRow label="Białko" cur={Math.round(sum.protein)} goal={dayGoals.protein} color="var(--macro-protein)" />
            <MacroRow label="Węglowodany" cur={Math.round(sum.carbs)} goal={dayGoals.carbs} color="var(--macro-carbs)" />
            <MacroRow label="Tłuszcz" cur={Math.round(sum.fat)} goal={dayGoals.fat} color="var(--macro-fat)" />
          </div>
        </div>
      </section>

      {/* Ask AI */}
      <section className="px-[18px]">
        <button
          onClick={() => { setOpenAssistant(true); openAdd(undefined); }}
          className="surface-card flex w-full items-center gap-3 p-4 text-left"
        >
          <div className="flex-1">
            <div className="text-[15px] font-bold tracking-tight">Zapytaj AI</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              Opisz posiłek lub zrób zdjęcie
            </div>
          </div>
          <span
            className="grid h-10 w-10 place-items-center rounded-full"
            style={{ background: "var(--muted)" }}
          >
            <Camera size={18} strokeWidth={1.8} />
          </span>
          <span
            className="grid h-10 w-10 place-items-center rounded-full text-primary-foreground"
            style={{ background: "var(--ink)" }}
          >
            <ArrowUp size={18} strokeWidth={2.2} />
          </span>
        </button>
        {openAssistant ? null : null}
      </section>

      {/* Meals */}
      <section className="space-y-3 px-[18px]">
        <h2 className="text-[17px] font-bold tracking-tight px-1">Posiłki</h2>
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

function IconCircle({ children, ...rest }: { children: React.ReactNode; "aria-label"?: string }) {
  return (
    <button
      {...rest}
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

function StatCol({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-1 flex-col px-1.5">
      <div className="num-tight text-[28px] font-extrabold leading-none tracking-tight">
        {value}
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-muted-foreground">
        <Icon size={13} strokeWidth={1.8} />
        <span className="text-[11px] font-semibold">{label}</span>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px self-stretch" style={{ background: "var(--hairline)" }} />;
}

function PlateDial({ consumed, goal }: { consumed: number; goal: number }) {
  const size = 240;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const pct = Math.max(0, Math.min(1, consumed / goal));
  // arc spans from -135deg to +135deg (270deg total)
  const startAngle = -135;
  const totalArc = 270;
  const endAngle = startAngle + totalArc * pct;
  const trackPath = describeArc(cx, cy, r, startAngle, startAngle + totalArc);
  const progPath = describeArc(cx, cy, r, startAngle, endAngle);
  const remaining = Math.max(0, goal - consumed);

  return (
    <div className="surface-hero relative p-5">
      <div className="flex items-start justify-between">
        <h2 className="text-[17px] font-bold tracking-tight">Talerz dnia</h2>
        <button
          className="grid h-9 w-9 place-items-center rounded-xl bg-card"
          style={{ boxShadow: "var(--shadow-card)" }}
          aria-label="Otwórz"
        >
          <ArrowUpRight size={16} strokeWidth={2} />
        </button>
      </div>
      <div className="relative mt-2 grid place-items-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* dotted plate rim */}
          <circle
            cx={cx}
            cy={cy}
            r={r + stroke / 2 + 4}
            fill="none"
            stroke="var(--ink)"
            strokeOpacity="0.18"
            strokeWidth="1.2"
            strokeDasharray="1.5 4"
          />
          {/* track */}
          <path
            d={trackPath}
            fill="none"
            stroke="var(--hairline)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* progress */}
          {pct > 0.001 && (
            <path
              d={progPath}
              fill="none"
              stroke="var(--accent-yellow)"
              strokeWidth={stroke}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="num-tight text-[44px] font-extrabold leading-none tracking-tight">
            {consumed}
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            z {goal} kcal
          </div>
          <div
            className="mt-3 rounded-full bg-card px-3 py-1 text-[11px] font-semibold"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            Pozostało {remaining}
          </div>
        </div>
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y,
    "A", r, r, 0, largeArcFlag, 0, end.x, end.y,
  ].join(" ");
}


function MacroRow({
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
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="num-tight text-[13px] font-semibold">
          <span>{cur}</span>
          <span className="text-muted-foreground"> / {goal} g</span>
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--hairline)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}
