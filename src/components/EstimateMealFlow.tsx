import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { estimateMealFromPhoto, type MealEstimate } from "@/lib/nutrition.functions";
import { type Meal, MEAL_LABEL } from "@/lib/store";

const MEALS: Meal[] = ["breakfast", "second_breakfast", "lunch", "dinner", "snack"];
const inputCls =
  "w-full rounded-xl border border-border/60 bg-card px-3 py-2.5 text-base outline-none focus:border-primary num-tight";

interface Props {
  meal: Meal;
  setMeal: (m: Meal) => void;
  onSubmit: (payload: {
    name: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => void;
}

type Phase = "capture" | "loading" | "review";

async function shrinkImage(file: File, maxDim = 1280, quality = 0.85): Promise<string> {
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
  return canvas.toDataURL("image/jpeg", quality);
}

export function EstimateMealFlow({ meal, setMeal, onSubmit }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("capture");
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);

  const estimateFn = useServerFn(estimateMealFromPhoto);

  const runEstimate = async (file: File) => {
    setPhase("loading");
    try {
      const dataUrl = await shrinkImage(file);
      setPreview(dataUrl);
      const base64 = dataUrl.split(",")[1] ?? "";
      const result = await estimateFn({
        data: {
          imageBase64: base64,
          mimeType: "image/jpeg",
          description: description.trim() || undefined,
        },
      });
      setEstimate(result);
      setPhase("review");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("AI_RATE_LIMIT")) toast.error("Za dużo żądań do AI. Spróbuj za chwilę.");
      else if (msg.includes("AI_CREDITS")) toast.error("Brak kredytów AI lub problem z kluczem.");
      else if (msg.includes("GEMINI_KEY_MISSING")) toast.error("Brak klucza Gemini w sekretach.");
      else toast.error("Nie udało się oszacować posiłku, spróbuj ponownie.");
      setPreview(null);
      setEstimate(null);
      setPhase("capture");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) runEstimate(file);
  };

  const reset = () => {
    setPhase("capture");
    setPreview(null);
    setEstimate(null);
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
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card py-10"
        >
          <div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground">
            <Camera size={24} />
          </div>
          <div className="text-center">
            <div className="text-base font-semibold">Zrób zdjęcie posiłku</div>
            <div className="text-xs text-muted-foreground">
              AI oszacuje wartości całej porcji
            </div>
          </div>
        </motion.button>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Krótki opis (opcjonalnie)
          </span>
          <input
            className={inputCls}
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="np. owsianka z bananem i orzechami, ok. 300 g"
          />
        </label>
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
          AI szacuje posiłek…
        </div>
      </div>
    );
  }

  if (!estimate) return null;

  const valid = estimate.name.trim().length > 0 && estimate.total.kcal > 0;
  const update = (k: keyof typeof estimate.total, v: string) => {
    const n = Number(v.replace(",", ".")) || 0;
    setEstimate({ ...estimate, total: { ...estimate.total, [k]: n } });
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({
          name: estimate.name.trim(),
          kcal: estimate.total.kcal,
          protein: estimate.total.protein,
          carbs: estimate.total.carbs,
          fat: estimate.total.fat,
        });
      }}
    >
      <div className="flex items-center gap-3">
        {preview && (
          <img src={preview} alt="" className="h-14 w-14 rounded-xl object-cover" />
        )}
        <div className="flex-1">
          <ConfidenceBadge confidence={estimate.confidence} />
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles size={10} />
            Wartości szacunkowe — zweryfikuj.
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

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Nazwa
        </span>
        <input
          className={inputCls}
          value={estimate.name}
          maxLength={80}
          onChange={(e) => setEstimate({ ...estimate, name: e.target.value })}
        />
      </label>

      <div className="rounded-2xl bg-foreground/5 p-3">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Cała porcja
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block text-center text-[10px] uppercase text-muted-foreground">
                {k === "kcal" ? "kcal" : k === "protein" ? "B" : k === "carbs" ? "W" : "T"}
              </span>
              <input
                className={`${inputCls} px-2 py-1.5 text-center text-sm`}
                inputMode="decimal"
                value={String(estimate.total[k])}
                onChange={(e) => update(k, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>

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

function ConfidenceBadge({ confidence }: { confidence: MealEstimate["confidence"] }) {
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
