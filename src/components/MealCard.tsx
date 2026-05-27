import { motion } from "framer-motion";
import { Plus, Coffee, UtensilsCrossed, Moon, Apple, Trash2 } from "lucide-react";
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
}

export function MealCard({ meal, entries, onAdd }: Props) {
  const Icon = MEAL_ICON[meal];
  const sum = sumEntries(entries);
  const remove = usePlate((s) => s.removeEntry);

  // Macro composition by kcal
  const pK = sum.protein * 4;
  const cK = sum.carbs * 4;
  const fK = sum.fat * 9;
  const totalK = pK + cK + fK;
  const pPct = totalK ? (pK / totalK) * 100 : 0;
  const cPct = totalK ? (cK / totalK) * 100 : 0;
  const fPct = totalK ? (fK / totalK) * 100 : 0;

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
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">{e.name}</div>
                <div className="text-[11px] text-muted-foreground num-tight">
                  {e.grams ? `${Math.round(e.grams)} g · ` : ""}
                  B {Math.round(e.protein)} · W {Math.round(e.carbs)} · T {Math.round(e.fat)}
                </div>
              </div>
              <div className="num-tight text-sm font-semibold">{Math.round(e.kcal)}</div>
              <button
                onClick={() => {
                  if (confirm(`Usunąć "${e.name}"?`)) remove(e.id);
                }}
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground active:scale-90 transition hover:text-[color:var(--protein)]"
                aria-label="Usuń"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
