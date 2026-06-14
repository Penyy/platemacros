import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, ChevronLeft, Hand, Moon, CalendarDays, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  getDayGoals,
  getWeekBalance,
  sumEntries,
  usePlate,
  ymd,
  type WeekBalance,
} from "@/lib/store";
import i18n from "@/lib/i18n";

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
type View = "combined" | "split";

function StatsPage() {
  const { t } = useTranslation();
  const locale = (i18n.language ?? "pl").startsWith("en") ? "en-US" : "pl-PL";
  const entries = usePlate((s) => s.entries);
  const profile = usePlate((s) => s.profile);
  const dayOffs = usePlate((s) => s.dayOffs);
  const [range, setRange] = useState<Range>(7);
  const [view, setView] = useState<View>("combined");
  const savedScrollRef = useRef(0);
  const pendingRestoreRef = useRef(false);

  const goSplit = () => {
    savedScrollRef.current = window.scrollY;
    setView("split");
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  };
  const goCombined = () => {
    pendingRestoreRef.current = true;
    setView("combined");
  };

  useEffect(() => {
    if (view === "combined" && pendingRestoreRef.current) {
      pendingRestoreRef.current = false;
      requestAnimationFrame(() =>
        window.scrollTo({ top: savedScrollRef.current })
      );
    }
  }, [view]);

  const days = useMemo(() => {
    const out: {
      date: string;
      label: string;
      totals: ReturnType<typeof sumEntries>;
      goals: ReturnType<typeof getDayGoals>;
      isDayOff: boolean;
    }[] = [];
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const date = ymd(d);
      const dayEntries = entries.filter((e) => e.date === date);
      out.push({
        date,
        label: d.toLocaleDateString(locale, { weekday: "short" }).slice(0, 2),
        totals: sumEntries(dayEntries),
        goals: getDayGoals(profile, date),
        isDayOff: dayOffs.has(date),
      });
    }
    return out;
  }, [entries, range, profile, locale, dayOffs]);

  const today = ymd(new Date());
  const weekBalance = useMemo(
    () => getWeekBalance(entries, profile, dayOffs, today),
    [entries, profile, dayOffs, today]
  );
  const countable = days.filter((d) => !d.isDayOff && d.totals.kcal > 0);
  const loggedDays = countable.length;
  const avg =
    loggedDays === 0
      ? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      : {
          kcal: Math.round(countable.reduce((s, d) => s + d.totals.kcal, 0) / loggedDays),
          protein: Math.round(countable.reduce((s, d) => s + d.totals.protein, 0) / loggedDays),
          carbs: Math.round(countable.reduce((s, d) => s + d.totals.carbs, 0) / loggedDays),
          fat: Math.round(countable.reduce((s, d) => s + d.totals.fat, 0) / loggedDays),
        };

  const avgGoal = useMemo(() => {
    const logged = days.filter((d) => !d.isDayOff && d.totals.kcal > 0);
    if (logged.length === 0) {
      const g = getDayGoals(profile, today);
      return { kcal: g.kcal, protein: g.protein, carbs: g.carbs, fat: g.fat };
    }
    return {
      kcal: Math.round(logged.reduce((s, d) => s + d.goals.kcal, 0) / logged.length),
      protein: Math.round(logged.reduce((s, d) => s + d.goals.protein, 0) / logged.length),
      carbs: Math.round(logged.reduce((s, d) => s + d.goals.carbs, 0) / logged.length),
      fat: Math.round(logged.reduce((s, d) => s + d.goals.fat, 0) / logged.length),
    };
  }, [days, profile, today]);

  const cycling = !!profile.weekly_targets_enabled;

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].isDayOff) continue;
    if (days[i].totals.kcal > 0) streak++;
    else break;
  }

  return (
    <div className="pb-4">
      <ScreenHeader
        title={t("stats.title")}
        subtitle={t("stats.lastDays", { n: range })}
        right={
          streak > 0 ? (
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{
                background: "rgba(255,255,255,.035)",
                border: "1px solid var(--hairline)",
              }}
            >
              <Flame
                size={14}
                strokeWidth={1.8}
                style={{ color: "var(--accent-yellow)", opacity: 0.8 }}
              />
              <span
                className="num-tight text-[13px]"
                style={{ fontWeight: 800, color: "var(--ink)" }}
              >
                {streak}
              </span>
            </div>
          ) : undefined
        }
      />


      <div className="px-[18px] space-y-3">
        <Pills value={range} onChange={setRange} />

        <AnimatePresence mode="wait">
          {view === "combined" ? (
            <motion.div
              key="combined"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
              style={{ willChange: "transform, opacity" }}
            >
              <WeekBalanceBar data={weekBalance} />
              <DeferredMount placeholderMinHeight={260}>
                <CombinedChart
                  days={days}
                  today={today}
                  range={range}
                  goalKcal={avgGoal.kcal}
                  avgKcal={avg.kcal}
                  cycling={cycling}
                  onTap={goSplit}
                />
              </DeferredMount>
            </motion.div>
          ) : (
            <motion.div
              key="split"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
              style={{ willChange: "transform, opacity" }}
            >
              <button
                onClick={goCombined}
                className="flex items-center gap-1 -ml-1 px-1 py-1 text-[13px] active:scale-[0.98] transition"
                style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
              >
                <ChevronLeft size={16} strokeWidth={1.8} />
                {t("stats.combinedView")}
              </button>
              {(
                [
                  { key: "kcal", title: t("stats.calories"), unit: "kcal", color: "var(--ink)", goal: avgGoal.kcal, avg: avg.kcal },
                  { key: "protein", title: t("macro.protein"), unit: "g", color: "var(--macro-protein)", goal: avgGoal.protein, avg: avg.protein },
                  { key: "carbs", title: t("macro.carbs"), unit: "g", color: "var(--macro-carbs)", goal: avgGoal.carbs, avg: avg.carbs },
                  { key: "fat", title: t("macro.fat"), unit: "g", color: "var(--macro-fat)", goal: avgGoal.fat, avg: avg.fat },
                ] as const
              ).map((m, idx) => (
                <motion.div
                  key={m.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  style={{ willChange: "transform, opacity" }}
                >
                  <DeferredMount placeholderMinHeight={220}>
                    <SplitChartCard
                      title={m.title}
                      unit={m.unit}
                      color={m.color}
                      goal={m.goal}
                      avg={m.avg}
                      today={today}
                      range={range}
                      cycling={cycling}
                      values={days.map((d) => ({
                        label: d.label,
                        date: d.date,
                        v: Math.round(d.totals[m.key as keyof typeof d.totals]),
                        goal: d.goals[m.key as keyof typeof d.goals],
                        isDayOff: d.isDayOff,
                      }))}
                      onTap={goCombined}
                    />
                  </DeferredMount>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DeferredMount({
  children,
  placeholderMinHeight,
}: {
  children: React.ReactNode;
  placeholderMinHeight?: number;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!ready) {
    return <div style={{ minHeight: placeholderMinHeight }} aria-hidden />;
  }
  return <>{children}</>;
}

function Pills({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const { t } = useTranslation();
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
            {t("stats.daysCount", { n: r })}
          </button>
        );
      })}
    </div>
  );
}

function WeekBalanceBar({ data }: { data: WeekBalance }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { balance, consumed, goal, daysCounted } = data;
  const has = daysCounted > 0;
  const over = has && balance > 0;
  const onTarget = has && balance === 0;
  const valueColor = over
    ? "#D9521E"
    : onTarget || !has
      ? "var(--ink)"
      : "var(--muted-foreground)";
  const valueText = !has
    ? t("week.empty")
    : over
      ? `+${balance} ${t("week.over")}`
      : onTarget
        ? t("week.onTarget")
        : `${Math.abs(balance)} ${t("week.under")}`;
  return (
    <div
      className="rounded-[16px] overflow-hidden"
      style={{
        background: over
          ? "color-mix(in oklab, #D9521E 6%, var(--card))"
          : "var(--card)",
        border: "0.5px solid var(--hairline)",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2.5 px-3.5 py-3 active:scale-[0.99] transition"
        aria-expanded={open}
      >
        <span
          className="flex items-center gap-2"
          style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}
        >
          <CalendarDays
            size={16}
            strokeWidth={1.8}
            style={{ color: "var(--muted-foreground)" }}
          />
          {t("week.title")}
          <ChevronDown
            size={14}
            strokeWidth={2}
            style={{
              color: "var(--muted-foreground)",
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          />
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: valueColor,
            whiteSpace: "nowrap",
          }}
        >
          {valueText}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="px-3.5 pt-2.5 pb-3.5"
              style={{ borderTop: "0.5px solid var(--hairline)" }}
            >
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "var(--muted-foreground)",
                }}
              >
                {t("week.info")}
              </p>
              {has && (
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ink)",
                    marginTop: 8,
                  }}
                >
                  {t("week.thisWeek", { consumed, goal })}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CombinedChart({
  days,
  today,
  range,
  goalKcal,
  avgKcal,
  cycling,
  onTap,
}: {
  days: { date: string; label: string; totals: ReturnType<typeof sumEntries>; isDayOff?: boolean }[];
  today: string;
  range: Range;
  goalKcal: number;
  avgKcal: number;
  cycling: boolean;
  onTap: () => void;
}) {
  const { t } = useTranslation();
  const dailyKcal = days.map((d) => (d.isDayOff ? 0 : Math.round(d.totals.kcal)));
  const scaleMax = Math.max(Math.max(...dailyKcal, 0), goalKcal) * 1.22 || 1;
  const goalTop = (1 - goalKcal / scaleMax) * 100;
  const showLabels = range === 7;
  const hasAnyDayOff = days.some((d) => d.isDayOff);

  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      onClick={onTap}
      className="rounded-[24px] p-4 cursor-pointer"
      style={{
        background: "var(--card)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--hairline)",
      }}
    >
      {(() => {
        const diff = avgKcal - goalKcal;
        const onTarget = goalKcal > 0 && Math.abs(diff) <= goalKcal * 0.02;
        return (
          <>
            <div className="relative flex items-end justify-between">
              <div>
                <div
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {t("stats.caloriesDistribution")}
                </div>
                <div
                  className="num-tight mt-0.5 text-[20px]"
                  style={{ fontWeight: 800, color: "var(--ink)" }}
                >
                  {t("stats.avgShort")} {avgKcal} kcal
                </div>
                {avgKcal > 0 && (
                  <div
                    className="num-tight text-[10px] mt-0.5"
                    style={{
                      color: onTarget ? "var(--accent-yellow)" : "var(--muted-foreground)",
                      fontWeight: 700,
                    }}
                  >
                    {onTarget
                      ? t("stats.onTarget")
                      : `${diff > 0 ? "+" : ""}${Math.round(diff)} ${t("stats.vsGoal")}`}
                  </div>
                )}
              </div>
              <div
                className="num-tight text-right text-[11px]"
                style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
              >
                {cycling ? t("stats.avgGoalShort") : t("stats.goalShort")} {goalKcal} kcal
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2.5">
              <LegendDot color="var(--macro-protein)" label={t("macro.protein")} />
              <LegendDot color="var(--macro-carbs)" label={t("macro.carbs")} />
              <LegendDot color="var(--macro-fat)" label={t("macro.fat")} />
            </div>
          </>
        );
      })()}


      <div className="relative mt-4 h-32">
        {/* Goal line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
          style={{
            top: `${goalTop}%`,
            borderColor: "var(--accent-yellow)",
            opacity: 0.5,
          }}
        />

        <div className="flex h-full items-end gap-[3px]">
          {days.map((d, i) => {
            const kcal = Math.round(d.totals.kcal);
            const h = Math.min(100, (kcal / scaleMax) * 100);
            const pK = d.totals.protein * 4;
            const cK = d.totals.carbs * 4;
            const fK = d.totals.fat * 9;
            const macroSum = pK + cK + fK;
            const isToday = d.date === today;
            if (d.isDayOff) {
              return (
                <div key={i} className="relative flex-1 h-full flex flex-col justify-end items-center">
                  <div
                    className="grid w-full place-items-center"
                    style={{
                      height: "55%",
                      borderRadius: "9px 9px 5px 5px",
                      border: "1px dashed var(--muted-foreground)",
                      background: "transparent",
                      opacity: 0.55,
                    }}
                  >
                    <Moon size={12} strokeWidth={1.6} style={{ color: "var(--muted-foreground)" }} />
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="relative flex-1 h-full flex flex-col justify-end items-center">
                {showLabels && kcal > 0 && (
                  <div
                    className="num-tight text-[9px] mb-1"
                    style={{
                      color: isToday ? "var(--ink)" : "var(--muted-foreground)",
                      fontWeight: 700,
                    }}
                  >
                    {kcal}
                  </div>
                )}
                <motion.div
                  className="relative w-full flex flex-col-reverse overflow-hidden"
                  style={{
                    height: `${h}%`,
                    transformOrigin: "bottom",
                    borderRadius: "9px 9px 5px 5px",
                  }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.02 }}
                >
                  {macroSum > 0 ? (
                    <>
                      <div
                        style={{
                          flexBasis: `${(pK / macroSum) * 100}%`,
                          background: "var(--macro-protein)",
                          boxShadow: "inset 0 -1.5px 0 rgba(0,0,0,.5)",
                        }}
                      />
                      <div
                        style={{
                          flexBasis: `${(cK / macroSum) * 100}%`,
                          background: "var(--macro-carbs)",
                          boxShadow: "inset 0 -1.5px 0 rgba(0,0,0,.5)",
                        }}
                      />
                      <div
                        style={{
                          flexBasis: `${(fK / macroSum) * 100}%`,
                          background: "var(--macro-fat)",
                        }}
                      />
                    </>
                  ) : (
                    <div style={{ flex: 1, background: "var(--hairline)", opacity: 0.6 }} />
                  )}
                  {/* Sheen top */}
                  <div
                    className="absolute inset-x-0 top-0 pointer-events-none"
                    style={{
                      height: "40%",
                      background: "linear-gradient(180deg, rgba(255,255,255,.22), transparent)",
                    }}
                  />
                  {/* Bottom darken */}
                  <div
                    className="absolute inset-x-0 bottom-0 pointer-events-none"
                    style={{
                      height: "40%",
                      background: "linear-gradient(transparent, rgba(0,0,0,.2))",
                    }}
                  />
                </motion.div>

              </div>
            );
          })}
        </div>
      </div>

      {hasAnyDayOff && (
        <div
          className="mt-2 text-center text-[10px]"
          style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
        >
          {t("dayoff.chartNote")}
        </div>
      )}

      {showLabels && (
        <div className="mt-1.5 flex gap-[3px]">
          {days.map((d, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[10px]"
              style={{
                color: d.date === today ? "var(--ink)" : "var(--muted-foreground)",
                fontWeight: 600,
              }}
            >
              {d.label}
            </div>
          ))}
        </div>
      )}

      <div
        className="mt-3 flex items-center justify-center gap-1.5 text-[11px]"
        style={{ color: "var(--muted-foreground)", opacity: 0.7, fontWeight: 600 }}
      >
        <Hand size={12} strokeWidth={1.8} />
        {t("stats.tapToSplit")}
      </div>
    </motion.div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-block rounded-full"
        style={{ width: 7, height: 7, background: color }}
      />
      <span
        className="text-[10px]"
        style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
      >
        {label}
      </span>
    </div>
  );
}

function SplitChartCard({
  title,
  unit,
  color,
  goal,
  avg,
  today,
  range,
  cycling,
  values,
  onTap,
}: {
  title: string;
  unit: string;
  color: string;
  goal: number;
  avg: number;
  today: string;
  range: Range;
  cycling: boolean;
  values: { label: string; date: string; v: number; goal: number; isDayOff?: boolean }[];
  onTap?: () => void;
}) {
  const { t } = useTranslation();
  const max = Math.max(Math.max(...values.filter((d) => !d.isDayOff).map((d) => d.v), 0), goal) * 1.1 || 1;
  const goalTop = (1 - goal / max) * 100;
  const showLabels = range === 7;
  const hasAnyDayOff = values.some((d) => d.isDayOff);
  const diff = avg - goal;
  const onTarget = goal > 0 && Math.abs(diff) <= goal * 0.02;




  return (
    <motion.div
      whileTap={onTap ? { scale: 0.99 } : undefined}
      onClick={onTap}
      className="rounded-[24px] p-4 relative overflow-hidden cursor-pointer"
      style={{
        background: "var(--card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Corner glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -40,
          right: -40,
          width: 180,
          height: 180,
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          opacity: 0.1,
        }}
      />

      <div className="relative flex items-end justify-between">
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
            {t("stats.avgShort")} {Math.round(avg)} {unit}
          </div>
          {avg > 0 && (
            <div
              className="num-tight text-[10px] mt-0.5"
              style={{
                color: onTarget ? "var(--accent-yellow)" : "var(--muted-foreground)",
                fontWeight: 700,
              }}
            >
              {onTarget
                ? t("stats.onTarget")
                : `${diff > 0 ? "+" : ""}${Math.round(diff)} ${t("stats.vsGoal")}`}
            </div>
          )}
        </div>
        <div
          className="num-tight text-right text-[11px]"
          style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
        >
          {cycling ? t("stats.avgGoalShort") : t("stats.goalShort")} {goal} {unit}
        </div>
      </div>

      <div className="relative mt-3" style={{ height: 108 }}>
        {/* Goal line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
          style={{
            top: `${goalTop}%`,
            borderColor: color,
            opacity: 0.45,
          }}
        />
        <div className="flex h-full items-end gap-[3px]">
          {values.map((d, i) => {
            const h = Math.min(100, (d.v / max) * 100);
            const isToday = d.date === today;
            if (d.isDayOff) {
              return (
                <div
                  key={i}
                  className="relative flex-1 h-full flex flex-col justify-end items-center"
                >
                  <div
                    className="grid place-items-center"
                    style={{
                      width: "60%",
                      height: "55%",
                      borderRadius: "9px 9px 5px 5px",
                      border: `1px dashed ${color}`,
                      background: "transparent",
                      opacity: 0.55,
                    }}
                  >
                    <Moon size={12} strokeWidth={1.6} style={{ color: "var(--muted-foreground)" }} />
                  </div>
                </div>
              );
            }
            return (
              <div
                key={i}
                className="relative flex-1 h-full flex flex-col justify-end items-center"
              >
                {showLabels && d.v > 0 && (
                  <div
                    className="num-tight text-[9px] mb-1"
                    style={{
                      color: isToday ? "var(--ink)" : "var(--muted-foreground)",
                      fontWeight: 700,
                    }}
                  >
                    {d.v}
                  </div>
                )}
                {/* Track */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 bottom-0 rounded-[9px_9px_5px_5px]"
                  style={{
                    width: "60%",
                    height: "100%",
                    background: "var(--hairline)",
                    opacity: 0.35,
                  }}
                />
                {/* Bar */}
                <motion.div
                  className="relative overflow-hidden"
                  style={{
                    width: "60%",
                    height: `${h}%`,
                    transformOrigin: "bottom",
                    background: color,
                    borderRadius: "9px 9px 5px 5px",
                    opacity: isToday || !isAnyToday(values, today) && i === values.length - 1 ? 1 : 0.8,
                  }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.02 }}
                >
                  {/* Sheen top */}
                  <div
                    className="absolute inset-x-0 top-0 pointer-events-none"
                    style={{
                      height: "40%",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,.22), transparent)",
                    }}
                  />
                  {/* Bottom darken */}
                  <div
                    className="absolute inset-x-0 bottom-0 pointer-events-none"
                    style={{
                      height: "40%",
                      background:
                        "linear-gradient(transparent, rgba(0,0,0,.2))",
                    }}
                  />
                </motion.div>
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
              style={{
                color: d.date === today ? "var(--ink)" : "var(--muted-foreground)",
                fontWeight: 600,
              }}
            >
              {d.label}
            </div>
          ))}
        </div>
      )}

      {hasAnyDayOff && (
        <div
          className="mt-2 text-center text-[10px]"
          style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
        >
          {t("dayoff.chartNote")}
        </div>
      )}
    </motion.div>
  );
}

function isAnyToday(values: { date: string }[], today: string) {
  return values.some((v) => v.date === today);
}
