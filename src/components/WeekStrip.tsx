import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePlate, ymd, sumEntries, getDayGoals } from "@/lib/store";

interface Props {
  selected: string;
  onSelect: (date: string) => void;
  weekOffset: number;
  setWeekOffset: (n: number) => void;
}

const DAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function MiniRing({
  pct,
  filled,
  isToday,
  isFuture,
}: {
  pct: number;
  filled: boolean;
  isToday: boolean;
  isFuture: boolean;
}) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <svg width={36} height={36} viewBox="0 0 36 36">
      <circle
        cx={18}
        cy={18}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity={isFuture ? 0.08 : 0.15}
        strokeWidth={2.5}
      />
      {!isFuture && (
        <circle
          cx={18}
          cy={18}
          r={r}
          fill="none"
          stroke={filled ? "var(--primary-foreground)" : "var(--primary)"}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform="rotate(-90 18 18)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      )}
      {isToday && (
        <circle
          cx={18}
          cy={18}
          r={17}
          fill="none"
          stroke="var(--primary)"
          strokeOpacity={0.5}
          strokeWidth={1}
        />
      )}
    </svg>
  );
}

export function WeekStrip({ selected, onSelect, weekOffset, setWeekOffset }: Props) {
  const today = new Date();
  const todayStr = ymd(today);
  const base = startOfWeek(today);
  base.setDate(base.getDate() + weekOffset * 7);

  const entries = usePlate((s) => s.entries);
  const profile = usePlate((s) => s.profile);
  const includeBurned = usePlate((s) => s.profile.include_burned);
  const burnedMap = usePlate((s) => s.burned);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });

  return (
    <div className="flex items-center gap-1 px-1">
      <button
        onClick={() => setWeekOffset(weekOffset - 1)}
        className="rounded-full p-1.5 text-muted-foreground active:scale-90 transition"
        aria-label="Poprzedni tydzień"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="flex flex-1 justify-between">
        {days.map((d, i) => {
          const s = ymd(d);
          const isSelected = s === selected;
          const isToday = s === todayStr;
          const isFuture = d > today && !isToday;
          const dayKcal = sumEntries(entries.filter((e) => e.date === s)).kcal;
          const dayBurned = burnedMap[s] ?? 0;
          const effGoal = includeBurned ? goalKcal + dayBurned : goalKcal;
          const pct = effGoal ? dayKcal / effGoal : 0;
          return (
            <button
              key={s}
              disabled={isFuture}
              onClick={() => onSelect(s)}
              className="flex flex-col items-center gap-1 disabled:opacity-40"
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {DAYS[i]}
              </span>
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={`relative grid place-items-center rounded-full text-[11px] font-semibold transition
                  ${isSelected ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                style={{ width: 36, height: 36 }}
              >
                <div className="absolute inset-0">
                  <MiniRing
                    pct={pct}
                    filled={isSelected}
                    isToday={isToday}
                    isFuture={isFuture}
                  />
                </div>
                <span className="relative">{d.getDate()}</span>
              </motion.div>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => setWeekOffset(weekOffset + 1)}
        className="rounded-full p-1.5 text-muted-foreground active:scale-90 transition"
        aria-label="Następny tydzień"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
