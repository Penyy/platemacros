import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { type LogEntry, type Meal, MEAL_LABEL, usePlate } from "@/lib/store";



const MEALS: Meal[] = ["breakfast", "second_breakfast", "lunch", "dinner", "snack"];

interface Props {
  entry: LogEntry | null;
  onClose: () => void;
}

export function EditEntrySheet({ entry, onClose }: Props) {
  const updateEntry = usePlate((s) => s.updateEntry);
  const products = usePlate((s) => s.products);
  const addProduct = usePlate((s) => s.addProduct);
  const updateProduct = usePlate((s) => s.updateProduct);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [name, setName] = useState("");
  const [meal, setMeal] = useState<Meal>("breakfast");
  const [grams, setGrams] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  useEffect(() => {
    if (!entry) return;
    setName(entry.name);
    setMeal(entry.meal);
    setGrams(entry.grams != null ? String(Math.round(entry.grams)) : "");
    setKcal(String(Math.round(entry.kcal)));
    setProtein(String(round1(entry.protein)));
    setCarbs(String(round1(entry.carbs)));
    setFat(String(round1(entry.fat)));
    setSaveToLibrary(false);
  }, [entry]);

  const save = () => {
    if (!entry) return;
    const g = grams.trim() === "" ? undefined : numOr(grams, entry.grams ?? 0);
    const finalName = name.trim() || entry.name;
    const finalKcal = numOr(kcal, entry.kcal);
    const finalProtein = numOr(protein, entry.protein);
    const finalCarbs = numOr(carbs, entry.carbs);
    const finalFat = numOr(fat, entry.fat);
    updateEntry(entry.id, {
      name: finalName,
      meal,
      grams: g,
      kcal: finalKcal,
      protein: finalProtein,
      carbs: finalCarbs,
      fat: finalFat,
    });

    if (saveToLibrary) {
      const hasGrams = g !== undefined && g > 0;
      const factor = hasGrams ? 100 / (g as number) : 1;
      const macros = {
        kcal: round1(finalKcal * factor),
        protein: round1(finalProtein * factor),
        carbs: round1(finalCarbs * factor),
        fat: round1(finalFat * factor),
      };
      const norm = finalName.trim().toLowerCase();
      const existing = products.find((p) => p.name.trim().toLowerCase() === norm);
      if (existing) {
        updateProduct(existing.id, { name: finalName, ...macros });
      } else {
        addProduct({ name: finalName, ...macros });
      }
      toast.success("Dodano do Twoich produktów");
    }

    onClose();
  };



  return (
    <AnimatePresence>
      {entry && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[430px] flex-col"
          >
            <div className="glass mx-2 mb-2 max-h-[90vh] overflow-y-auto rounded-[28px] p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-foreground/20" />
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">Edytuj pozycję</h2>
                <button
                  onClick={onClose}
                  aria-label="Zamknij"
                  className="grid h-9 w-9 place-items-center rounded-full bg-foreground/10"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <Field label="Nazwa">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={onFocusScroll}
                    className="w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-[15px] outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>

                <Field label="Posiłek">
                  <div className="flex flex-wrap gap-1.5">
                    {MEALS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMeal(m)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          meal === m
                            ? "bg-primary text-primary-foreground"
                            : "bg-foreground/10 text-foreground/80"
                        }`}
                      >
                        {MEAL_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <NumField label="Gramatura (g)" value={grams} setValue={setGrams} />
                  <NumField label="Kalorie (kcal)" value={kcal} setValue={setKcal} />
                  <NumField label="Białko (g)" value={protein} setValue={setProtein} />
                  <NumField label="Węglowodany (g)" value={carbs} setValue={setCarbs} />
                  <NumField label="Tłuszcz (g)" value={fat} setValue={setFat} />
                </div>

                <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl bg-foreground/5 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={saveToLibrary}
                    onChange={(e) => setSaveToLibrary(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-[13px] font-medium">Dodaj do moich produktów</span>
                </label>

                <div className="mt-2 flex gap-2 pt-2">

                  <button
                    onClick={onClose}
                    className="flex-1 rounded-full bg-foreground/10 px-4 py-3 text-sm font-semibold"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={save}
                    className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                  >
                    Zapisz
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function NumField({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(",", "."))}
        onFocus={(e) => {
          onFocusScroll(e);
          e.currentTarget.select();
        }}
        className="num-tight w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-right text-[15px] font-semibold outline-none focus:ring-1 focus:ring-primary"
      />
    </Field>
  );
}

function onFocusScroll(e: React.FocusEvent<HTMLElement>) {
  const el = e.currentTarget;
  setTimeout(() => {
    try {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch {
      /* noop */
    }
  }, 100);
}

function numOr(s: string, fallback: number) {
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
