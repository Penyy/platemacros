import { useRef } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { Plus, Coffee, UtensilsCrossed, Moon, Apple, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { type LogEntry, type Meal, MEAL_LABEL, sumEntries, usePlate } from "@/lib/store";

const MEAL_ICON: Record<Meal, React.ComponentType<{ size?: number }>> = {
  breakfast: Coffee,
  lunch: UtensilsCrossed,
  dinner: Moon,
  snack: Apple,
};

const MEAL_TINT: Record<Meal, string> = {
  breakfast: "from-amber-400/30 to-amber-200/20 text-amber-700 dark:text-amber-300",
  lunch: "from-emerald-400/30 to-emerald-200/20 text-emerald-700 dark:text-emerald-300",
  dinner: "from-indigo-400/30 to-indigo-200/20 text-indigo-700 dark:text-indigo-300",
  snack: "from-rose-400/30 to-rose-200/20 text-rose-700 dark:text-rose-300",
};

interface Props {
  meal: Meal;
  entries: LogEntry[];
  onAdd: (m: Meal) => void;
  date: string;
  prevDayHasEntries?: boolean;
}

export function MealCard({ meal, entries, onAdd, date, prevDayHasEntries }: Props) {
  const Icon = MEAL_ICON[meal];
  const sum = sumEntries(entries);
  const remove = usePlate((s) => s.removeEntry);
  const repeatMeal = usePlate((s) => s.repeatMealFromPrevDay);

  const pK = sum.protein * 4;
  const cK = sum.carbs * 4;
  const fK = sum.fat * 9;
  const totalK = pK + cK + fK;
  const pPct = totalK ? (pK / totalK) * 100 : 0;
  const cPct = totalK ? (cK / totalK) * 100 : 0;
  const fPct = totalK ? (fK / totalK) * 100 : 0;

  const handleRepeat = () => {
    const n = repeatMeal(date, meal);
    if (n === 0) toast.message("Brak posiłku do skopiowania");
    else toast.success(`Skopiowano ${n} ${n === 1 ? "pozycję" : "pozycje"}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-card p-4 shadow-sm border border-border/60"
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${MEAL_TINT[meal]}`}
        >
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold leading-tight">{MEAL_LABEL[meal]}</div>
          <div className="text-xs text-muted-foreground">
            {entries.length === 0
              ? "Brak pozycji"
              : `${entries.length} ${entries.length === 1 ? "pozycja" : "pozycje"}`}
          </div>
        </div>
        <div className="num-tight text-right">
          <div className="text-xl font-bold">{Math.round(sum.kcal)}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">kcal</div>
        </div>
        {prevDayHasEntries && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleRepeat}
            className="grid h-9 w-9 place-items-center rounded-full bg-foreground/10 text-foreground/80"
            aria-label="Powtórz z wczoraj"
            title="Powtórz z wczoraj"
          >
            <RotateCcw size={16} />
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onAdd(meal)}
          className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"
          aria-label="Dodaj do posiłku"
        >
          <Plus size={18} />
        </motion.button>
      </div>

      {totalK > 0 && (
        <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div style={{ width: `${pPct}%`, background: "var(--protein)" }} />
          <div style={{ width: `${cPct}%`, background: "var(--carbs)" }} />
          <div style={{ width: `${fPct}%`, background: "var(--fat)" }} />
        </div>
      )}

      {entries.length > 0 && (
        <ul className="mt-3 divide-y divide-border/60">
          <AnimatePresence initial={false}>
            {entries.map((e) => (
              <SwipeRow key={e.id} entry={e} onDelete={() => remove(e.id)} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </motion.div>
  );
}

const DELETE_THRESHOLD = 90;

function SwipeRow({ entry: e, onDelete }: { entry: LogEntry; onDelete: () => void }) {
  const x = useMotionValue(0);
  const armed = useRef(false);
  // background reveal width follows finger (positive distance)
  const revealOpacity = useTransform(x, (v) => Math.min(1, Math.abs(Math.min(0, v)) / 60));
  const labelOpacity = useTransform(x, (v) => (v <= -DELETE_THRESHOLD ? 1 : 0.6));

  return (
    <motion.li
      layout
      initial={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.2 }}
      className="relative overflow-hidden"
    >
      <motion.div
        style={{ opacity: revealOpacity }}
        className="pointer-events-none absolute inset-0 flex items-center justify-end gap-2 pr-4 text-white"
        aria-hidden
      >
        <span
          className="absolute inset-0"
          style={{ background: "#FF3B30" }}
        />
        <motion.div
          style={{ opacity: labelOpacity }}
          className="relative flex items-center gap-2 text-sm font-semibold"
        >
          <Trash2 size={16} />
          <span>Usuń</span>
        </motion.div>
      </motion.div>
      <motion.div
        drag="x"
        dragDirectionLock
        style={{ x }}
        dragConstraints={{ left: -160, right: 0 }}
        dragElastic={{ left: 0.1, right: 0 }}
        onDrag={(_, info) => {
          if (!armed.current && info.offset.x <= -DELETE_THRESHOLD) {
            armed.current = true;
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              try { navigator.vibrate(10); } catch { /* noop */ }
            }
          } else if (armed.current && info.offset.x > -DELETE_THRESHOLD) {
            armed.current = false;
          }
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x <= -DELETE_THRESHOLD || info.velocity.x < -800) {
            // animate off and delete
            x.set(-400);
            setTimeout(onDelete, 120);
          } else {
            x.set(0);
            armed.current = false;
          }
        }}
        className="relative flex items-center gap-3 bg-card py-2 touch-pan-y"
      >
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-medium">{e.name}</div>
          <div className="text-[11px] text-muted-foreground num-tight">
            {e.grams ? `${Math.round(e.grams)} g · ` : ""}
            B {Math.round(e.protein)} · W {Math.round(e.carbs)} · T {Math.round(e.fat)}
          </div>
        </div>
        <div className="num-tight text-sm font-semibold">{Math.round(e.kcal)}</div>
      </motion.div>
    </motion.li>
  );
}
