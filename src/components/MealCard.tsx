import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Coffee, Sandwich, UtensilsCrossed, Moon, Apple, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { type LogEntry, type Meal, MEAL_LABEL, sumEntries, usePlate } from "@/lib/store";

const MEAL_ICON: Record<Meal, React.ComponentType<{ size?: number }>> = {
  breakfast: Coffee,
  second_breakfast: Sandwich,
  lunch: UtensilsCrossed,
  dinner: Moon,
  snack: Apple,
};

const MEAL_TINT: Record<Meal, string> = {
  breakfast: "from-amber-400/30 to-amber-200/20 text-amber-700 dark:text-amber-300",
  second_breakfast: "from-lime-400/30 to-lime-200/20 text-lime-700 dark:text-lime-300",
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
  const addEntry = usePlate((s) => s.addEntry);
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

  const handleDelete = (entry: LogEntry) => {
    remove(entry.id);
    toast(`Usunięto ${entry.name}`, {
      duration: 5000,
      action: {
        label: "Cofnij",
        onClick: () => {
          addEntry({
            date: entry.date,
            meal: entry.meal,
            name: entry.name,
            grams: entry.grams,
            kcal: entry.kcal,
            protein: entry.protein,
            carbs: entry.carbs,
            fat: entry.fat,
            sub_items: entry.sub_items,
          });
        },
      },
    });
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
              <SwipeRow key={e.id} entry={e} onDelete={() => handleDelete(e)} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </motion.div>
  );
}

const AXIS_LOCK_PX = 6; // px movement before we decide horizontal vs vertical

function SwipeRow({ entry: e, onDelete }: { entry: LogEntry; onDelete: () => void }) {
  const containerRef = useRef<HTMLLIElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [armed, setArmed] = useState(false);
  const [exiting, setExiting] = useState(false);

  const stateRef = useRef({
    startX: 0,
    startY: 0,
    pointerId: -1,
    axis: "none" as "none" | "x" | "y",
    width: 0,
    armed: false,
    moved: false,
  });

  const onPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    const w = rowRef.current?.offsetWidth ?? 0;
    stateRef.current = {
      startX: ev.clientX,
      startY: ev.clientY,
      pointerId: ev.pointerId,
      axis: "none",
      width: w,
      armed: false,
      moved: false,
    };
  };

  const onPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (s.pointerId !== ev.pointerId) return;
    const deltaX = ev.clientX - s.startX;
    const deltaY = ev.clientY - s.startY;

    if (s.axis === "none") {
      const ax = Math.abs(deltaX);
      const ay = Math.abs(deltaY);
      if (ax < AXIS_LOCK_PX && ay < AXIS_LOCK_PX) return;
      if (ax > ay) {
        s.axis = "x";
        // capture so we keep receiving move/up even off-element
        try { (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId); } catch { /* noop */ }
      } else {
        s.axis = "y";
        return;
      }
    }

    if (s.axis !== "x") return;
    s.moved = true;
    const max = s.width || 1;
    // Only allow left swipe; small elastic right
    let next = deltaX;
    if (next > 0) next = next * 0.15;
    if (next < -max) next = -max;
    setDx(next);

    const threshold = max * 0.5;
    const past = -next >= threshold;
    if (past && !s.armed) {
      s.armed = true;
      setArmed(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try { navigator.vibrate(10); } catch { /* noop */ }
      }
    } else if (!past && s.armed) {
      s.armed = false;
      setArmed(false);
    }
  };

  const finish = (commit: boolean) => {
    const s = stateRef.current;
    const max = s.width || (rowRef.current?.offsetWidth ?? 0) || 1;
    if (commit) {
      setExiting(true);
      setDx(-max);
      window.setTimeout(onDelete, 220);
    } else {
      setArmed(false);
      s.armed = false;
      setDx(0);
    }
  };

  const onPointerUp = (ev: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (s.pointerId !== ev.pointerId) return;
    try { (ev.currentTarget as HTMLElement).releasePointerCapture(ev.pointerId); } catch { /* noop */ }
    if (s.axis !== "x" || !s.moved) {
      s.pointerId = -1;
      return;
    }
    const max = s.width || 1;
    const past = -dx >= max * 0.5;
    s.pointerId = -1;
    finish(past);
  };

  const onPointerCancel = (ev: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (s.pointerId !== ev.pointerId) return;
    s.pointerId = -1;
    finish(false);
  };

  // Reset axis lock if entry changes
  useEffect(() => {
    return () => {
      stateRef.current.pointerId = -1;
    };
  }, []);

  const max = rowRef.current?.offsetWidth ?? 1;
  const progress = Math.min(1, -dx / Math.max(1, max * 0.5));

  return (
    <motion.li
      ref={containerRef}
      layout
      initial={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.22 }}
      className="relative overflow-hidden"
    >
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-end pr-5 text-white"
        style={{
          background: armed ? "#D9241B" : "#FF3B30",
          opacity: progress > 0 ? Math.min(1, 0.4 + progress * 0.6) : 0,
        }}
        aria-hidden
      >
        <div className="flex items-center gap-2">
          {armed && (
            <span className="text-sm font-semibold">Puść aby usunąć</span>
          )}
          <span
            className="inline-flex"
            style={{ transform: `scale(${0.7 + progress * 0.4})` }}
          >
            <Trash2 size={20} />
          </span>
        </div>
      </div>
      <div
        ref={rowRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{
          transform: `translate3d(${dx}px,0,0)`,
          transition:
            stateRef.current.pointerId === -1
              ? exiting
                ? "transform 220ms cubic-bezier(0.4,0,0.2,1)"
                : "transform 320ms cubic-bezier(0.22,1,0.36,1)"
              : "none",
          touchAction: "pan-y",
        }}
        className="relative flex items-center gap-3 bg-card py-2"
      >
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-medium">{e.name}</div>
          <div className="text-[11px] text-muted-foreground num-tight">
            {e.grams ? `${Math.round(e.grams)} g · ` : ""}
            B {Math.round(e.protein)} · W {Math.round(e.carbs)} · T {Math.round(e.fat)}
          </div>
        </div>
        <div className="num-tight text-sm font-semibold">{Math.round(e.kcal)}</div>
      </div>
    </motion.li>
  );
}
