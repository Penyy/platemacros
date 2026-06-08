import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { type LogEntry, type Meal, usePlate } from "@/lib/store";

const MEALS: Meal[] = ["breakfast", "second_breakfast", "lunch", "dinner", "snack"];

interface Props {
  entry: LogEntry | null;
  onClose: () => void;
}

export function EditEntrySheet({ entry, onClose }: Props) {
  const { t } = useTranslation();
  const updateEntry = usePlate((s) => s.updateEntry);
  const removeEntry = usePlate((s) => s.removeEntry);
  const products = usePlate((s) => s.products);
  const addProduct = usePlate((s) => s.addProduct);
  const updateProduct = usePlate((s) => s.updateProduct);

  const [name, setName] = useState("");
  const [meal, setMeal] = useState<Meal>("breakfast");
  const [grams, setGrams] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [sugars, setSugars] = useState("");
  const [satFat, setSatFat] = useState("");
  const [sodium, setSodium] = useState("");

  useEffect(() => {
    if (!entry) return;
    setName(entry.name);
    setMeal(entry.meal);
    setGrams(entry.grams != null ? String(Math.round(entry.grams)) : "");
    setKcal(String(Math.round(entry.kcal)));
    setProtein(String(round1(entry.protein)));
    setCarbs(String(round1(entry.carbs)));
    setFat(String(round1(entry.fat)));
    setFiber(entry.fiber_g != null ? String(round1(entry.fiber_g)) : "");
    setSugars(entry.sugars_g != null ? String(round1(entry.sugars_g)) : "");
    setSatFat(entry.saturated_fat_g != null ? String(round1(entry.saturated_fat_g)) : "");
    setSodium(entry.sodium_mg != null ? String(Math.round(entry.sodium_mg)) : "");
  }, [entry]);



  const optNum = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

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
      fiber_g: optNum(fiber),
      sugars_g: optNum(sugars),
      saturated_fat_g: optNum(satFat),
      sodium_mg: optNum(sodium),
    });
    onClose();
  };

  const saveToLibrary = () => {
    if (!entry) return;
    const g = grams.trim() === "" ? undefined : numOr(grams, entry.grams ?? 0);
    const finalName = name.trim() || entry.name;
    const finalKcal = numOr(kcal, entry.kcal);
    const finalProtein = numOr(protein, entry.protein);
    const finalCarbs = numOr(carbs, entry.carbs);
    const finalFat = numOr(fat, entry.fat);
    const hasGrams = g !== undefined && g > 0;
    const factor = hasGrams ? 100 / (g as number) : 1;
    const fiberV = optNum(fiber);
    const sugarsV = optNum(sugars);
    const satV = optNum(satFat);
    const sodV = optNum(sodium);
    const macros = {
      kcal: round1(finalKcal * factor),
      protein: round1(finalProtein * factor),
      carbs: round1(finalCarbs * factor),
      fat: round1(finalFat * factor),
      fiber_g: fiberV != null ? round1(fiberV * factor) : null,
      sugars_g: sugarsV != null ? round1(sugarsV * factor) : null,
      saturated_fat_g: satV != null ? round1(satV * factor) : null,
      sodium_mg: sodV != null ? Math.round(sodV * factor) : null,
    };
    const norm = finalName.trim().toLowerCase();
    const existing = products.find((p) => p.name.trim().toLowerCase() === norm);
    if (existing) {
      updateProduct(existing.id, { name: finalName, ...macros });
    } else {
      addProduct({ name: finalName, ...macros });
    }
    toast.success(t("item.addedToProducts"));
  };


  const handleDelete = () => {
    if (!entry) return;
    removeEntry(entry.id);
    toast.success(t("item.deleted"));
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
            className="fixed inset-x-0 z-50 mx-auto flex w-full max-w-[430px] flex-col"
            style={{ bottom: "var(--kb-inset, 0px)" }}
          >
            <div
              className="mx-2 mb-[max(env(safe-area-inset-bottom),1.25rem)] max-h-[92vh] overflow-y-auto rounded-t-[32px] rounded-b-[28px] bg-card p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div
                className="mx-auto mb-4 h-1.5 w-10 rounded-full"
                style={{ background: "var(--hairline)" }}
              />
              <div className="mb-5 flex items-center justify-between">
                <h2
                  className="text-[22px] leading-tight"
                  style={{
                    fontFamily: "Manrope, sans-serif",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    color: "var(--ink)",
                  }}
                >
                  {t("item.editTitle")}
                </h2>
                <button
                  onClick={onClose}
                  aria-label={t("common.close")}
                  className="grid h-9 w-9 place-items-center rounded-full"
                  style={{ background: "var(--hairline)", color: "var(--ink)" }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <CardField label={t("item.name")}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={onFocusScroll}
                    placeholder={t("item.namePlaceholder")}
                    className="w-full bg-transparent text-[17px] leading-tight outline-none placeholder:text-foreground/30"
                    style={{ fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}
                  />
                </CardField>

                {/* Meal pills */}
                <div className="flex flex-wrap gap-1.5">
                  {MEALS.map((m) => {
                    const active = meal === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMeal(m)}
                        className="rounded-full px-3.5 py-1.5 text-[12px] transition active:scale-[0.97]"
                        style={{
                          background: active ? "var(--ink)" : "var(--hairline)",
                          color: active ? "var(--card)" : "var(--ink)",
                          fontWeight: 600,
                        }}
                      >
                        {t(`meal.${m}`)}
                      </button>
                    );
                  })}
                </div>

                {/* Gramatura + kcal hero */}
                <div className="grid grid-cols-2 gap-2">
                  <NumCard label={t("item.amount")} unit="g" value={grams} onChange={setGrams} />
                  <NumCard label={t("item.kcal")} unit="kcal" value={kcal} onChange={setKcal} hero />
                </div>

                {/* Macros */}
                <div className="grid grid-cols-3 gap-2">
                  <NumCard
                    label={t("macro.protein")}
                    unit="g"
                    value={protein}
                    onChange={setProtein}
                    dot="var(--macro-protein)"
                  />
                  <NumCard
                    label={t("macro.carbs")}
                    unit="g"
                    value={carbs}
                    onChange={setCarbs}
                    dot="var(--macro-carbs, var(--accent-yellow))"
                  />
                  <NumCard
                    label={t("macro.fat")}
                    unit="g"
                    value={fat}
                    onChange={setFat}
                    dot="var(--macro-fat, #6FB4E8)"
                  />
                </div>

                {(() => {
                  const sg = Number(sugars);
                  const cb = Number(carbs);
                  if (sugars.trim() === "" || !Number.isFinite(sg) || !Number.isFinite(cb)) return null;
                  const complex = Math.max(0, Math.round((cb - sg) * 10) / 10);
                  return (
                    <div className="px-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      {t("item.carbBreakdown", { simple: round1(sg), complex })}
                    </div>
                  );
                })()}

                {/* Extras (optional) */}
                <div className="grid grid-cols-2 gap-2">
                  <NumCard label={t("item.fiber")} unit="g" value={fiber} onChange={setFiber} />
                  <NumCard label={t("item.sugars")} unit="g" value={sugars} onChange={setSugars} />
                  <NumCard label={t("item.satFatShort")} unit="g" value={satFat} onChange={setSatFat} />
                  <NumCard label={t("item.sodium")} unit="mg" value={sodium} onChange={setSodium} />
                </div>



                {/* Actions */}
                <div className="pt-2 space-y-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={save}
                    className="w-full rounded-full py-4 text-[15px] tracking-tight"
                    style={{
                      background: "var(--ink)",
                      color: "var(--card)",
                      fontWeight: 700,
                    }}
                  >
                    {t("common.save")}
                  </motion.button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={saveToLibrary}
                      className="rounded-full py-3 text-[13px] active:scale-[0.98]"
                      style={{
                        background: "var(--hairline)",
                        color: "var(--ink)",
                        fontWeight: 600,
                      }}
                    >
                      {t("item.addToProducts")}
                    </button>
                    <button
                      onClick={handleDelete}
                      className="flex items-center justify-center gap-1.5 rounded-full py-3 text-[13px] active:scale-[0.98]"
                      style={{
                        background: "var(--hairline)",
                        color: "var(--macro-protein)",
                        fontWeight: 600,
                      }}
                    >
                      <Trash2 size={14} strokeWidth={1.9} />
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CardField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label
      className="block rounded-2xl bg-card p-3.5"
      style={{ border: "1px solid var(--hairline)", boxShadow: "var(--shadow-card)" }}
    >
      <span
        className="block text-[10px] uppercase tracking-wider"
        style={{ color: "var(--muted-foreground)", fontWeight: 700 }}
      >
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function NumCard({
  label,
  unit,
  value,
  onChange,
  dot,
  hero,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  dot?: string;
  hero?: boolean;
}) {
  return (
    <label
      className="block min-w-0 rounded-2xl bg-card p-3"
      style={{
        border: hero ? "2px solid var(--accent-yellow)" : "1px solid var(--hairline)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <span
        className="flex items-center gap-1 text-[10px] uppercase tracking-wider"
        style={{ color: "var(--muted-foreground)", fontWeight: 700 }}
      >
        {dot && (
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: dot }}
            aria-hidden
          />
        )}
        <span className="truncate">{label}</span>
      </span>
      <div className="mt-1 flex items-baseline gap-1">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(",", "."))}
          onFocus={(e) => {
            onFocusScroll(e);
            e.currentTarget.select();
          }}
          placeholder="0"
          className={`num-tight w-full min-w-0 bg-transparent leading-none tracking-tight outline-none placeholder:text-foreground/20 ${
            hero ? "text-[32px]" : "text-[22px]"
          }`}
          style={{ fontWeight: 800, color: "var(--ink)" }}
        />
        <span
          className="text-[11px]"
          style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
        >
          {unit}
        </span>
      </div>
    </label>
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
