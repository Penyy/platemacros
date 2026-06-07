import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, lazy, Suspense } from "react";
import {
  Layers,
  Zap,
  PencilLine,
  Search,
  ScanLine,
  Sparkles,
  X,
} from "lucide-react";
import { type Meal, MEAL_LABEL, type Product, usePlate, ymd } from "@/lib/store";
import { ScanLabelFlow } from "./ScanLabelFlow";
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
  const [mode, setMode] = useState<Mode>("menu");
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
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[430px] flex-col"
          >
            <div className="mx-2 mb-[max(env(safe-area-inset-bottom),1rem)] rounded-[28px] bg-card p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-foreground/20" />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">
                  {mode === "menu"
                    ? "Dodaj pozycję"
                    : mode === "quick"
                    ? "Szybkie dodawanie"
                    : mode === "manual"
                    ? "Wpisz ręcznie"
                    : mode === "search"
                    ? "Szukaj produktu"
                    : mode === "compound"
                    ? "Złożony posiłek"
                    : mode === "barcode"
                    ? "Skanuj kod kreskowy"
                    : mode === "assistant"
                    ? "PlateAI"
                    : "Skanuj etykietę"}
                </h2>
                <button
                  onClick={mode === "menu" ? close : () => setMode("menu")}
                  className="grid h-8 w-8 place-items-center rounded-full bg-foreground/10"
                  aria-label="Zamknij"
                >
                  <X size={16} />
                </button>
              </div>

              {mode === "menu" && (
                <MenuGrid onPick={(m) => setMode(m)} />
              )}
              {mode === "quick" && (
                <QuickForm
                  meal={meal}
                  setMeal={setMeal}
                  onSubmit={(payload) => {
                    addEntry({ ...payload, date, meal });
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
                <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">Ładowanie skanera…</div>}>
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
                <AssistantFlow defaultMeal={meal} onClose={close} />
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
  const items: { id: PickMode; label: string; icon: typeof ScanLine; soon: boolean }[] = [
    { id: "assistant", label: "PlateAI", icon: Sparkles, soon: false },
    { id: "barcode", label: "Skanuj kod kreskowy", icon: ScanLine, soon: false },
    { id: "compound", label: "Złożony posiłek", icon: Layers, soon: false },
    { id: "search", label: "Szukaj produktu", icon: Search, soon: false },
    { id: "quick", label: "Szybkie dodawanie", icon: Zap, soon: false },
    { id: "manual", label: "Wpisz ręcznie", icon: PencilLine, soon: false },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        const disabled = it.soon;
        return (
          <motion.button
            key={it.id}
            whileTap={disabled ? undefined : { scale: 0.96 }}
            disabled={disabled}
            onClick={() => !disabled && onPick(it.id)}
            className={`group relative flex flex-col items-start gap-3 rounded-2xl p-4 text-left transition ${
              disabled ? "opacity-50" : "active:opacity-80"
            }`}
            style={{ background: "var(--muted)" }}
          >
            <Icon size={24} strokeWidth={1.7} />
            <div className="text-[14px] font-bold leading-tight tracking-tight">{it.label}</div>
            {it.soon && (
              <span className="absolute right-2 top-2 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                Wkrótce
              </span>
            )}
          </motion.button>
        );
      })}
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
  meal,
  setMeal,
  onSubmit,
}: {
  meal: Meal;
  setMeal: (m: Meal) => void;
  onSubmit: (p: FormPayload) => void;
}) {
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");

  const valid = name.trim() && Number(kcal) > 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({
          name: name.trim(),
          kcal: Number(kcal),
          protein: Number(p) || 0,
          carbs: Number(c) || 0,
          fat: Number(f) || 0,
        });
      }}
    >
      <MealPicker meal={meal} setMeal={setMeal} />

      <input
        autoFocus
        className="w-full rounded-2xl bg-muted px-4 py-3 text-[15px] font-semibold outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nazwa, np. Jogurt naturalny"
      />

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
            className="num-tight w-full bg-transparent text-[40px] font-extrabold leading-none tracking-tight outline-none placeholder:text-foreground/20"
            inputMode="numeric"
            value={kcal}
            onChange={(e) => setKcal(e.target.value.replace(",", "."))}
            placeholder="0"
          />
          <span className="text-[13px] font-semibold text-muted-foreground">kcal</span>
        </div>
      </div>

      {/* Optional macros */}
      <div className="grid grid-cols-3 gap-2">
        <MacroField color="var(--macro-protein)" label="Białko" value={p} onChange={setP} />
        <MacroField color="var(--macro-carbs)" label="Węglowodany" value={c} onChange={setC} />
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
    <label className="block rounded-2xl bg-muted p-3">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
        {label}
      </span>
      <input
        className="num-tight mt-1 w-full bg-transparent text-[18px] font-extrabold tracking-tight outline-none placeholder:text-foreground/25"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(",", "."))}
        placeholder="opcjonalnie"
      />
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
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Szukaj w bibliotece…"
        className={inputCls}
      />
      {products.length === 0 ? (
        <p className="px-1 py-2 text-center text-sm text-muted-foreground">
          Twoja biblioteka jest pusta. Dodaj produkty w „Moje produkty”
          (Profil).
        </p>
      ) : results.length === 0 ? (
        <p className="px-1 py-2 text-center text-sm text-muted-foreground">
          Brak wyników.
        </p>
      ) : (
        <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(p);
                  setGrams("100");
                }}
                className="flex w-full items-center gap-2 rounded-xl border border-border/60 bg-card p-3 text-left active:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="num-tight mt-0.5 text-[11px] text-muted-foreground">
                    {Math.round(p.kcal)} kcal · B {Math.round(p.protein)} · W{" "}
                    {Math.round(p.carbs)} · T {Math.round(p.fat)} / 100 g
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
