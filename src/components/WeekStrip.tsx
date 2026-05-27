import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ymd } from "@/lib/store";

interface Props {
  selected: string;
  onSelect: (date: string) => void;
  weekOffset: number;
  setWeekOffset: (n: number) => void;
}

const DAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function WeekStrip({ selected, onSelect, weekOffset, setWeekOffset }: Props) {
  const today = new Date();
  const todayStr = ymd(today);
  const base = startOfWeek(today);
  base.setDate(base.getDate() + weekOffset * 7);

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
          return (
            <button
              key={s}
              disabled={isFuture}
              onClick={() => onSelect(s)}
              className="flex flex-col items-center gap-1 disabled:opacity-30"
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {DAYS[i]}
              </span>
              <motion.span
                whileTap={{ scale: 0.9 }}
                className={`relative grid h-9 w-9 place-items-center rounded-full text-sm font-semibold transition
                  ${isSelected ? "bg-primary text-primary-foreground" : "text-foreground"}
                  ${isToday && !isSelected ? "ring-1 ring-primary/60" : ""}`}
              >
                {d.getDate()}
              </motion.span>
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
