import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  Layers,
  Zap,
  PencilLine,
  Search,
  ScanLine,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";
import { type Meal, MEAL_LABEL, type Product, usePlate, ymd, defaultPlusMenuVisibility, type PlusMenuItemId } from "@/lib/store";
import { ScanLabelFlow } from "./ScanLabelFlow";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { CompoundMealFlow } from "./CompoundMealFlow";

const BarcodeScanFlow = lazy(() =>
  import("./BarcodeScanFlow").then((m) => ({ default: m.BarcodeScanFlow })),
);
import { AssistantFlow } from "./AssistantFlow";

type Mode = "menu" | "quick" | "manual" | "scan" | "search" | "compound" | "barcode" | "assistant";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultMeal?: Meal;
  date: string;
}

const MEALS: Meal[] = ["breakfast", "second_breakfast", "lunch", "dinner", "snack"];

export function AddSheet({ open, onClose, defaultMeal, date }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("menu");
  useScrollLock(open);
  const [meal, setMeal] = useState<Meal>(defaultMeal ?? "breakfast");
  const addEntry = usePlate((s) => s.addEntry);

  useEffect(() => {
    if (open) {
      setMode("menu");
      setMeal(defaultMeal ?? guessMeal());
    }
  }, [open, defaultMeal]);

  const close = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/30"
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 z-50 mx-auto flex w-full max-w-[430px] flex-col"
            style={{ bottom: "var(--kb-inset, 0px)" }}
          >
            <div
              className="mx-2 mb-[max(env(safe-area-inset-bottom),1.25rem)] rounded-t-[30px] rounded-b-[28px] bg-card px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1.5rem)]"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div
                className="mx-auto mb-3 h-1.5 w-11 rounded-full"
                style={{ background: "var(--hairline)" }}
              />
              <div className="mb-5 flex items-center justify-between">
                <h2
                  className={mode === "menu" ? "text-[27px] leading-tight" : "text-[22px] leading-tight"}
                  style={{ fontFamily: "Manrope, sans-serif", fontWeight: mode === "menu" ? 800 : 700, letterSpacing: "-0.03em", color: "var(--ink)" }}
                >
                  {mode === "menu"
                    ? t("add.title.menu")
                    : mode === "quick"
                    ? t("add.title.quick")
                    : mode === "manual"
                    ? t("add.title.manual")
                    : mode === "search"
                    ? t("add.title.search")
                    : mode === "compound"
                    ? t("add.title.compound")
                    : mode === "barcode"
                    ? t("add.title.barcode")
                    : mode === "assistant"
                    ? t("add.title.assistant")
                    : t("add.title.scan")}
                </h2>
                <button
                  onClick={mode === "menu" ? close : () => setMode("menu")}
                  className="grid h-10 w-10 place-items-center rounded-full"
                  style={{ background: "var(--card)", border: "1px solid var(--hairline)", color: "var(--muted-foreground)" }}
                  aria-label={t("add.close")}
                >
                  <X size={16} strokeWidth={1.9} />
                </button>
              </div>


              {mode === "menu" && (
                <MenuGrid onPick={(m) => setMode(m)} />
              )}
              {mode === "quick" && (
                <QuickForm
                  onSubmit={(payload) => {
                    const m = defaultMeal ?? guessMeal();
                    addEntry({ ...payload, date, meal: m });
                    close();
                  }}
                />
              )}
              {mode === "manual" && (
                <ManualForm
                  meal={meal}
                  setMeal={setMeal}
                  onSubmit={(payload) => {
                    addEntry({ ...payload, date, meal });
                    close();
                  }}
                />
              )}
              {mode === "scan" && (
                <ScanLabelFlow
                  meal={meal}
                  setMeal={setMeal}
                  onSubmit={(payload) => {
                    addEntry({ ...payload, date, meal });
                    close();
                  }}
                />
              )}
              {mode === "search" && (
                <SearchForm
                  meal={meal}
                  setMeal={setMeal}
                  onSubmit={(payload) => {
                    addEntry({ ...payload, date, meal });
                    close();
                  }}
                />
              )}
              {mode === "compound" && (
                <CompoundMealFlow
                  meal={meal}
                  setMeal={setMeal}
                  onSubmit={(payload) => {
                    addEntry({ ...payload, date, meal });
                    close();
                  }}
                />
              )}
              {mode === "barcode" && (
                <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">{t("add.barcodeLoading")}</div>}>
                  <BarcodeScanFlow
                    meal={meal}
                    setMeal={setMeal}
                    onSubmit={(payload) => {
                      addEntry({ ...payload, date, meal });
                      close();
                    }}
                  />
                </Suspense>
              )}
              {mode === "assistant" && (
                <AssistantFlow defaultMeal={meal} date={date} onClose={close} />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function guessMeal(): Meal {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 12) return "second_breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

type PickMode = "quick" | "manual" | "search" | "compound" | "barcode" | "assistant";

function MenuGrid({ onPick }: { onPick: (m: PickMode) => void }) {
  const visibility = usePlate(
    (s) => s.profile.plus_menu_visibility ?? defaultPlusMenuVisibility,
  );

  const heroVisible = visibility["assistant" as PlusMenuItemId] !== false;

  const gridAll: { id: PickMode; label: string; subtitle: string; icon: typeof ScanLine }[] = [
    { id: "barcode", label: "Skanuj kod kreskowy", subtitle: "Kod kreskowy EAN", icon: ScanLine },
    { id: "search", label: "Szukaj produktu", subtitle: "Baza Open Food Facts", icon: Search },
    { id: "quick", label: "Szybkie dodawanie", subtitle: "Tylko kcal i makra", icon: Zap },
    { id: "compound", label: "Złożony posiłek", subtitle: "Z wielu składników", icon: Layers },
    { id: "manual", label: "Wpisz ręcznie", subtitle: "Własna pozycja z wartościami", icon: PencilLine },
  ];
  const gridItems = gridAll.filter((it) => visibility[it.id as PlusMenuItemId] !== false);
  const oddTail = gridItems.length % 2 === 1;

  let idx = 0;

  return (
    <div className="flex flex-col gap-3">
      {heroVisible && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: idx++ * 0.04, ease: [0.22, 1, 0.36, 1] }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onPick("assistant")}
          className="flex w-full items-center gap-4 rounded-[20px] p-4 text-left"
          style={{
            background:
              "radial-gradient(120% 140% at 90% 0%, rgba(244,181,0,.16), transparent 55%), linear-gradient(135deg, rgba(244,181,0,.10), rgba(244,181,0,.03))",
            border: "1px solid rgba(244,181,0,.28)",
          }}
        >
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
            style={{ background: "var(--accent-yellow)", color: "#161616" }}
          >
            <Sparkles size={26} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="text-[18px] leading-tight"
              style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em" }}
            >
              PlateAI
            </div>
            <div
              className="mt-1 text-[12.5px] leading-snug"
              style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
            >
              Opisz słowami albo zrób zdjęcie posiłku lub etykiety
            </div>
          </div>
          <ArrowRight size={20} strokeWidth={1.9} style={{ color: "var(--accent-yellow)" }} />
        </motion.button>
      )}

      {gridItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {gridItems.map((it, i) => {
            const Icon = it.icon;
            const spanFull = oddTail && i === gridItems.length - 1;
            return (
              <motion.button
                key={it.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: (idx++) * 0.04, ease: [0.22, 1, 0.36, 1] }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPick(it.id)}
                className="relative flex min-h-[128px] flex-col items-start justify-between gap-3 rounded-[20px] p-[18px] text-left"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--hairline)",
                  gridColumn: spanFull ? "span 2" : undefined,
                }}
              >
                <span
                  className="grid h-[52px] w-[52px] place-items-center rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,.06), transparent), rgba(255,255,255,.05)",
                    border: "1px solid var(--hairline)",
                    color: "var(--ink)",
                  }}
                >
                  <Icon size={24} strokeWidth={1.8} />
                </span>
                <div className="w-full">
                  <div
                    className="text-[16px] leading-tight"
                    style={{ fontFamily: "Manrope, sans-serif", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}
                  >
                    {it.label}
                  </div>
                  <div
                    className="mt-1 text-[12.5px] leading-snug"
                    style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
                  >
                    {it.subtitle}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MealPicker({ meal, setMeal }: { meal: Meal; setMeal: (m: Meal) => void }) {
  return (
    <div className="flex gap-1 rounded-full bg-foreground/5 p-1">
      {MEALS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMeal(m)}
          className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition ${
            meal === m
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          }`}
        >
          {MEAL_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

interface FormPayload {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  grams?: number;
  fiber_g?: number | null;
  sugars_g?: number | null;
  saturated_fat_g?: number | null;
  sodium_mg?: number | null;
}


function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-border/60 bg-card px-3 py-2.5 text-base outline-none focus:border-primary num-tight";

function QuickForm({
  onSubmit,
}: {
  onSubmit: (p: FormPayload) => void;
}) {
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");

  const valid = Number(kcal) > 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({
          name: "Szybki wpis",
          kcal: Number(kcal),
          protein: Number(p) || 0,
          carbs: Number(c) || 0,
          fat: Number(f) || 0,
        });
      }}
    >
      {/* Hero kcal field */}
      <div
        className="rounded-2xl bg-card p-4"
        style={{
          border: "2px solid var(--accent-yellow)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Kalorie
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <input
            autoFocus
            className="num-tight w-full bg-transparent text-[40px] font-extrabold leading-none tracking-tight outline-none placeholder:text-foreground/20"
            inputMode="numeric"
            value={kcal}
            onChange={(e) => setKcal(e.target.value.replace(",", "."))}
            placeholder="0"
          />
          <span className="text-[13px] font-semibold text-muted-foreground">kcal</span>
        </div>
      </div>

      {/* Optional macros — same field style as Calories above */}
      <div className="grid grid-cols-3 gap-2">
        <MacroField color="var(--macro-protein)" label="Białko" value={p} onChange={setP} />
        <MacroField color="var(--macro-carbs)" label="Węgl." value={c} onChange={setC} />
        <MacroField color="var(--macro-fat)" label="Tłuszcz" value={f} onChange={setF} />
      </div>

      <SubmitButton disabled={!valid}>Dodaj do dziennika</SubmitButton>
    </form>
  );
}

function MacroField({
  color,
  label,
  value,
  onChange,
}: {
  color: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className="block min-w-0 rounded-2xl bg-card p-3"
      style={{
        border: "1px solid var(--hairline)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </span>
      <div className="mt-1 flex items-baseline gap-1">
        <input
          className="num-tight w-full min-w-0 bg-transparent text-[22px] font-extrabold leading-none tracking-tight outline-none placeholder:text-foreground/20"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(",", "."))}
          placeholder="0"
        />
        <span className="text-[11px] font-semibold text-muted-foreground">g</span>
      </div>
    </label>
  );
}

function ManualForm({
  meal,
  setMeal,
  onSubmit,
}: {
  meal: Meal;
  setMeal: (m: Meal) => void;
  onSubmit: (p: FormPayload) => void;
}) {
  const [name, setName] = useState("");
  const [portion, setPortion] = useState("100");
  const [count, setCount] = useState("1");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [fiber, setFiber] = useState("");
  const [sugars, setSugars] = useState("");
  const [satFat, setSatFat] = useState("");
  const [sodium, setSodium] = useState("");

  const optNum = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const portionG = Number(portion) || 0;
  const n = Number(count) || 0;
  const totalGrams = portionG * n;
  const factor = n;
  const total = {
    kcal: (Number(kcal) || 0) * factor,
    p: (Number(p) || 0) * factor,
    c: (Number(c) || 0) * factor,
    f: (Number(f) || 0) * factor,
  };
  const fiberV = optNum(fiber);
  const sugarsV = optNum(sugars);
  const satV = optNum(satFat);
  const sodV = optNum(sodium);
  const totalExtras = {
    fiber_g: fiberV != null ? Math.round(fiberV * factor * 10) / 10 : null,
    sugars_g: sugarsV != null ? Math.round(sugarsV * factor * 10) / 10 : null,
    saturated_fat_g: satV != null ? Math.round(satV * factor * 10) / 10 : null,
    sodium_mg: sodV != null ? Math.round(sodV * factor) : null,
  };
  const complex =
    sugarsV != null && Number(c) > 0
      ? Math.max(0, Math.round((Number(c) - sugarsV) * 10) / 10)
      : null;

  const valid = name.trim() && Number(kcal) > 0 && portionG > 0 && n > 0;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({
          name: name.trim(),
          grams: totalGrams,
          kcal: total.kcal,
          protein: total.p,
          carbs: total.c,
          fat: total.f,
          fiber_g: totalExtras.fiber_g,
          sugars_g: totalExtras.sugars_g,
          saturated_fat_g: totalExtras.saturated_fat_g,
          sodium_mg: totalExtras.sodium_mg,
        });
      }}
    >
      <MealPicker meal={meal} setMeal={setMeal} />
      <Field label="Nazwa">
        <input
          autoFocus
          className={inputCls}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="np. Kurczak grillowany"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Porcja (g)">
          <input
            className={inputCls}
            inputMode="decimal"
            value={portion}
            onChange={(e) => setPortion(e.target.value.replace(",", "."))}
          />
        </Field>
        <Field label="Ilość porcji">
          <input
            className={inputCls}
            inputMode="decimal"
            value={count}
            onChange={(e) => setCount(e.target.value.replace(",", "."))}
          />
        </Field>
      </div>
      <Field label="Kalorie / porcję">
        <input
          className={inputCls}
          inputMode="decimal"
          value={kcal}
          onChange={(e) => setKcal(e.target.value.replace(",", "."))}
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="B / porcję">
          <input
            className={inputCls}
            inputMode="decimal"
            value={p}
            onChange={(e) => setP(e.target.value.replace(",", "."))}
          />
        </Field>
        <Field label="W / porcję">
          <input
            className={inputCls}
            inputMode="decimal"
            value={c}
            onChange={(e) => setC(e.target.value.replace(",", "."))}
          />
        </Field>
        <Field label="T / porcję">
          <input
            className={inputCls}
            inputMode="decimal"
            value={f}
            onChange={(e) => setF(e.target.value.replace(",", "."))}
          />
        </Field>
      </div>
      {complex != null && (
        <div className="px-1 text-[11px] text-muted-foreground">
          w tym proste: {sugarsV} g · złożone: {complex} g
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Błonnik (g)">
          <input
            className={inputCls}
            inputMode="decimal"
            value={fiber}
            onChange={(e) => setFiber(e.target.value.replace(",", "."))}
          />
        </Field>
        <Field label="Cukry (g)">
          <input
            className={inputCls}
            inputMode="decimal"
            value={sugars}
            onChange={(e) => setSugars(e.target.value.replace(",", "."))}
          />
        </Field>
        <Field label="Tł. nasyc. (g)">
          <input
            className={inputCls}
            inputMode="decimal"
            value={satFat}
            onChange={(e) => setSatFat(e.target.value.replace(",", "."))}
          />
        </Field>
        <Field label="Sód (mg)">
          <input
            className={inputCls}
            inputMode="decimal"
            value={sodium}
            onChange={(e) => setSodium(e.target.value.replace(",", "."))}
          />
        </Field>
      </div>
      {valid && (
        <div className="rounded-2xl bg-foreground/5 p-3 num-tight">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Razem
          </div>
          <div className="mt-0.5 text-sm">
            <span className="text-lg font-bold">{Math.round(total.kcal)}</span> kcal ·{" "}
            {Math.round(totalGrams)} g
          </div>
          <div className="text-xs text-muted-foreground">
            B {Math.round(total.p)} · W {Math.round(total.c)} · T {Math.round(total.f)}
          </div>
        </div>
      )}
      <SubmitButton disabled={!valid}>Dodaj do dziennika</SubmitButton>
    </form>
  );
}


function SubmitButton({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      type="submit"
      disabled={disabled}
      className="mt-2 w-full rounded-full bg-primary py-4 text-[15px] font-bold tracking-tight text-primary-foreground disabled:opacity-40"
    >
      {children}
    </motion.button>
  );
}

function SearchForm({
  meal,
  setMeal,
  onSubmit,
}: {
  meal: Meal;
  setMeal: (m: Meal) => void;
  onSubmit: (p: FormPayload) => void;
}) {
  const products = usePlate((s) => s.products);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [grams, setGrams] = useState("100");

  const results = products
    .filter((p) =>
      p.name.toLowerCase().includes(query.trim().toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pl"))
    .slice(0, 30);

  const g = Number(grams) || 0;
  const scale = g / 100;
  const total = selected
    ? {
        kcal: selected.kcal * scale,
        protein: selected.protein * scale,
        carbs: selected.carbs * scale,
        fat: selected.fat * scale,
      }
    : null;

  const valid = selected && g > 0;

  if (selected) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid || !total) return;
          onSubmit({
            name: selected.name,
            grams: g,
            kcal: total.kcal,
            protein: total.protein,
            carbs: total.carbs,
            fat: total.fat,
          });
        }}
      >
        <MealPicker meal={meal} setMeal={setMeal} />
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Wybierz inny produkt
        </button>
        <div className="rounded-2xl bg-foreground/5 p-3">
          <div className="text-sm font-semibold">{selected.name}</div>
          <div className="num-tight mt-0.5 text-[11px] text-muted-foreground">
            {Math.round(selected.kcal)} kcal · B {Math.round(selected.protein)} ·
            W {Math.round(selected.carbs)} · T {Math.round(selected.fat)} / 100 g
          </div>
        </div>
        <Field label="Ile gramów">
          <input
            autoFocus
            className={inputCls}
            inputMode="decimal"
            value={grams}
            onChange={(e) => setGrams(e.target.value.replace(",", "."))}
          />
        </Field>
        {total && (
          <div className="rounded-2xl bg-foreground/5 p-3 num-tight">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Razem
            </div>
            <div className="mt-0.5 text-sm">
              <span className="text-lg font-bold">{Math.round(total.kcal)}</span>{" "}
              kcal · {Math.round(g)} g
            </div>
            <div className="text-xs text-muted-foreground">
              B {Math.round(total.protein)} · W {Math.round(total.carbs)} · T{" "}
              {Math.round(total.fat)}
            </div>
          </div>
        )}
        <SubmitButton disabled={!valid}>Dodaj do dziennika</SubmitButton>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <Search size={16} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj w bibliotece"
          className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-[color:var(--muted-foreground)]"
          style={{ color: "var(--ink)", fontWeight: 500 }}
        />
      </div>
      {products.length === 0 ? (
        <p
          className="px-1 py-2 text-center text-[13px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          Twoja biblioteka jest pusta. Dodaj produkty w „Moje produkty”.
        </p>
      ) : results.length === 0 ? (
        <p
          className="px-1 py-2 text-center text-[13px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          Brak wyników — dodaj produkt w „Moje produkty”.
        </p>
      ) : (
        <ul className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(p);
                  setGrams("100");
                }}
                className="flex w-full items-center gap-3 rounded-[20px] bg-card p-3.5 text-left active:opacity-80"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[15px]"
                    style={{ fontWeight: 700, color: "var(--ink)" }}
                  >
                    {p.name}
                  </div>
                  <div
                    className="num-tight mt-0.5 text-[11.5px]"
                    style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
                  >
                    B {Math.round(p.protein)} · W {Math.round(p.carbs)} · T {Math.round(p.fat)} g / 100 g
                  </div>
                </div>
                <div
                  className="num-tight shrink-0 text-right text-[15px]"
                  style={{ fontWeight: 800, color: "var(--ink)" }}
                >
                  {Math.round(p.kcal)}
                  <span
                    className="ml-0.5 text-[10px]"
                    style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
                  >
                    kcal
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
