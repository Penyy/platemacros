import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { Camera, Loader2, RotateCcw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { scanNutritionLabel, type NutritionLabel } from "@/lib/nutrition.functions";
import { type Meal, MEAL_LABEL, usePlate } from "@/lib/store";

const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

interface Props {
  meal: Meal;
  setMeal: (m: Meal) => void;
  onSubmit: (payload: {
    name: string;
    grams: number;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => void;
}

type Phase = "capture" | "loading" | "review";

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

async function shrinkImage(file: File, maxDim = 1600, quality = 0.85): Promise<{ dataUrl: string; previewUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Brak canvas 2D");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl, previewUrl: dataUrl };
}

export function ScanLabelFlow({ meal, setMeal, onSubmit }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("capture");
  const [preview, setPreview] = useState<string | null>(null);
  const [label, setLabel] = useState<NutritionLabel | null>(null);
  const [grams, setGrams] = useState("100");
  const [saveToLib, setSaveToLib] = useState(false);
  const addProduct = usePlate((s) => s.addProduct);
  const scan = useServerFn(scanNutritionLabel);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhase("loading");
    try {
      const { dataUrl, previewUrl } = await shrinkImage(file);
      setPreview(previewUrl);
      const base64 = dataUrl.split(",")[1] ?? "";
      const result = await scan({ data: { imageBase64: base64, mimeType: "image/jpeg" } });
      setLabel(result);
      setPhase("review");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("AI_RATE_LIMIT")) {
        toast.error("Za dużo żądań do AI. Spróbuj za chwilę.");
      } else if (msg.includes("AI_CREDITS")) {
        toast.error("Brak kredytów AI lub problem z kluczem Gemini.");
      } else if (msg.includes("GEMINI_KEY_MISSING")) {
        toast.error("Brak klucza Gemini w sekretach.");
      } else {
        toast.error("Nie udało się odczytać etykiety, spróbuj ponownie.");
      }
      setPreview(null);
      setLabel(null);
      setPhase("capture");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const reset = () => {
    setPhase("capture");
    setPreview(null);
    setLabel(null);
    setGrams("100");
  };

  if (phase === "capture") {
    return (
      <div className="space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card py-10"
        >
          <div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground">
            <Camera size={24} />
          </div>
          <div className="text-center">
            <div className="text-base font-semibold">Zrób zdjęcie etykiety</div>
            <div className="text-xs text-muted-foreground">
              Najlepsze rezultaty: dobrze oświetlona tabela odżywcza
            </div>
          </div>
        </motion.button>
        <MealPicker meal={meal} setMeal={setMeal} />
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        {preview && (
          <img
            src={preview}
            alt=""
            className="h-32 w-32 rounded-2xl object-cover opacity-60"
          />
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Czytam etykietę…
        </div>
      </div>
    );
  }

  // review
  if (!label) return null;

  const g = Math.max(0, Number(grams.replace(",", ".")) || 0);
  const factor = g / 100;
  const totals = {
    kcal: round1(label.per100.kcal * factor),
    protein: round1(label.per100.protein * factor),
    carbs: round1(label.per100.carbs * factor),
    fat: round1(label.per100.fat * factor),
  };
  const valid = label.name.trim().length > 0 && g > 0;

  const updatePer100 = (key: keyof typeof label.per100, value: string) => {
    const n = Number(value.replace(",", ".")) || 0;
    setLabel({ ...label, per100: { ...label.per100, [key]: n } });
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({
          name: label.name.trim(),
          grams: g,
          kcal: totals.kcal,
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
        });
      }}
    >
      <div className="flex items-center gap-3">
        {preview && (
          <img src={preview} alt="" className="h-14 w-14 rounded-xl object-cover" />
        )}
        <div className="flex-1">
          <ConfidenceBadge confidence={label.confidence} />
          <div className="mt-1 text-[11px] text-muted-foreground">
            Sprawdź i popraw wartości jeśli trzeba.
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="grid h-9 w-9 place-items-center rounded-full bg-foreground/10"
          aria-label="Zrób ponownie"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <Field label="Nazwa">
        <input
          className={inputCls}
          value={label.name}
          maxLength={80}
          onChange={(e) => setLabel({ ...label, name: e.target.value })}
          placeholder="np. Jogurt naturalny"
          autoFocus={!label.name}
        />
      </Field>

      <div className="rounded-2xl bg-foreground/5 p-3">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Wartości na 100 g
        </div>
        <div className="grid grid-cols-4 gap-2">
          <SmallField label="kcal" value={String(label.per100.kcal)} onChange={(v) => updatePer100("kcal", v)} />
          <SmallField label="B" value={String(label.per100.protein)} onChange={(v) => updatePer100("protein", v)} />
          <SmallField label="W" value={String(label.per100.carbs)} onChange={(v) => updatePer100("carbs", v)} />
          <SmallField label="T" value={String(label.per100.fat)} onChange={(v) => updatePer100("fat", v)} />
        </div>
      </div>

      <Field label="Ile gramów zjadłeś/aś?">
        <input
          className={inputCls}
          inputMode="decimal"
          value={grams}
          onChange={(e) => setGrams(e.target.value.replace(",", "."))}
        />
      </Field>

      {valid && (
        <div className="rounded-2xl bg-foreground/5 p-3 num-tight">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Razem
          </div>
          <div className="mt-0.5 text-sm">
            <span className="text-lg font-bold">{totals.kcal}</span> kcal · {g} g
          </div>
          <div className="text-xs text-muted-foreground">
            B {totals.protein} · W {totals.carbs} · T {totals.fat}
          </div>
        </div>
      )}

      <MealPicker meal={meal} setMeal={setMeal} />

      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        disabled={!valid}
        className="mt-1 w-full rounded-2xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-40"
      >
        Dodaj do dziennika
      </motion.button>
    </form>
  );
}

function ConfidenceBadge({ confidence }: { confidence: NutritionLabel["confidence"] }) {
  const map = {
    high: { label: "Wysoka pewność", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    medium: { label: "Średnia pewność", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    low: { label: "Niska pewność", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  } as const;
  const it = map[confidence];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${it.cls}`}>
      {it.label}
    </span>
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
            meal === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          {MEAL_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border/60 bg-card px-3 py-2.5 text-base outline-none focus:border-primary num-tight";

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

function SmallField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        className={`${inputCls} px-2 py-1.5 text-center text-sm`}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
