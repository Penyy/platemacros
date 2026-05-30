import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { Camera, Loader2, Plus, Trash2, RotateCcw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { scanNutritionLabel, type NutritionLabel } from "@/lib/nutrition.functions";
import { type Meal, MEAL_LABEL } from "@/lib/store";

const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

interface Ingredient {
  id: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

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
    note?: string;
  }) => void;
}

type Phase = "list" | "capture" | "loading" | "review";

const inputCls =
  "w-full rounded-xl border border-border/60 bg-card px-3 py-2.5 text-base outline-none focus:border-primary num-tight";

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

async function shrinkImage(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
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

export function CompoundMealFlow({ meal, setMeal, onSubmit }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("list");
  const [items, setItems] = useState<Ingredient[]>([]);
  const [mealName, setMealName] = useState("");

  const [label, setLabel] = useState<NutritionLabel | null>(null);
  const [grams, setGrams] = useState("100");

  const scan = useServerFn(scanNutritionLabel);

  const sum = items.reduce(
    (a, x) => ({
      kcal: a.kcal + x.kcal,
      protein: a.protein + x.protein,
      carbs: a.carbs + x.carbs,
      fat: a.fat + x.fat,
      grams: a.grams + x.grams,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 },
  );

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhase("loading");
    try {
      const dataUrl = await shrinkImage(file);
      const base64 = dataUrl.split(",")[1] ?? "";
      const result = await scan({ data: { imageBase64: base64, mimeType: "image/jpeg" } });
      setLabel(result);
      setGrams("100");
      setPhase("review");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("AI_RATE_LIMIT")) toast.error("Za dużo żądań do AI. Spróbuj za chwilę.");
      else if (msg.includes("AI_CREDITS")) toast.error("Brak kredytów AI lub problem z kluczem.");
      else if (msg.includes("GEMINI_KEY_MISSING")) toast.error("Brak klucza Gemini w sekretach.");
      else toast.error("Nie udało się odczytać etykiety, spróbuj ponownie.");
      setPhase("list");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addCurrent = () => {
    if (!label) return;
    const g = Math.max(0, Number(grams) || 0);
    if (!label.name.trim() || g <= 0) return;
    const factor = g / 100;
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: label.name.trim(),
        grams: g,
        kcal: round1(label.per100.kcal * factor),
        protein: round1(label.per100.protein * factor),
        carbs: round1(label.per100.carbs * factor),
        fat: round1(label.per100.fat * factor),
      },
    ]);
    setLabel(null);
    setPhase("list");
  };

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <Loader2 size={20} className="animate-spin" />
        <div className="text-sm text-muted-foreground">Czytam etykietę…</div>
      </div>
    );
  }

  if (phase === "review" && label) {
    const g = Math.max(0, Number(grams) || 0);
    const factor = g / 100;
    const t = {
      kcal: round1(label.per100.kcal * factor),
      protein: round1(label.per100.protein * factor),
      carbs: round1(label.per100.carbs * factor),
      fat: round1(label.per100.fat * factor),
    };
    const update = (k: keyof typeof label.per100, v: string) => {
      const n = Number(v.replace(",", ".")) || 0;
      setLabel({ ...label, per100: { ...label.per100, [k]: n } });
    };
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Nowy składnik
          </span>
          <button
            type="button"
            onClick={() => {
              setLabel(null);
              setPhase("list");
            }}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Anuluj
          </button>
        </div>
        <input
          className={inputCls}
          value={label.name}
          maxLength={80}
          onChange={(e) => setLabel({ ...label, name: e.target.value })}
          placeholder="Nazwa składnika"
        />
        <div className="rounded-2xl bg-foreground/5 p-3">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Na 100 g
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
                  value={String(label.per100[k])}
                  onChange={(e) => update(k, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Ile gramów
          </span>
          <input
            className={inputCls}
            inputMode="decimal"
            value={grams}
            onChange={(e) => setGrams(e.target.value.replace(",", "."))}
          />
        </label>
        <div className="rounded-2xl bg-foreground/5 p-3 num-tight">
          <div className="text-sm">
            <span className="text-lg font-bold">{t.kcal}</span> kcal · {g} g
          </div>
          <div className="text-xs text-muted-foreground">
            B {t.protein} · W {t.carbs} · T {t.fat}
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={addCurrent}
          disabled={!label.name.trim() || g <= 0}
          className="w-full rounded-2xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-40"
        >
          Dodaj składnik
        </motion.button>
      </div>
    );
  }

  // list phase
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

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
          Brak składników. Skanuj etykiety po kolei.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{it.name}</div>
                <div className="num-tight text-[11px] text-muted-foreground">
                  {Math.round(it.grams)} g · {Math.round(it.kcal)} kcal · B{" "}
                  {Math.round(it.protein)} · W {Math.round(it.carbs)} · T {Math.round(it.fat)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}
                className="grid h-8 w-8 place-items-center rounded-full bg-foreground/10"
                aria-label="Usuń"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="rounded-2xl bg-foreground/5 p-3 num-tight">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Suma
          </div>
          <div className="mt-0.5 text-sm">
            <span className="text-lg font-bold">{Math.round(sum.kcal)}</span> kcal ·{" "}
            {Math.round(sum.grams)} g
          </div>
          <div className="text-xs text-muted-foreground">
            B {Math.round(sum.protein)} · W {Math.round(sum.carbs)} · T {Math.round(sum.fat)}
          </div>
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card py-4 text-sm font-semibold"
      >
        <Camera size={16} />
        {items.length === 0 ? "Skanuj pierwszą etykietę" : "Dodaj kolejny składnik"}
      </motion.button>

      {items.length > 0 && (
        <>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Nazwa posiłku
            </span>
            <input
              className={inputCls}
              value={mealName}
              maxLength={80}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="np. Owsianka z owocami"
            />
          </label>

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

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            disabled={!mealName.trim() || items.length === 0}
            onClick={() => {
              const note = items
                .map((i) => `${i.name} ${Math.round(i.grams)}g`)
                .join(" + ");
              onSubmit({
                name: mealName.trim(),
                grams: round1(sum.grams),
                kcal: round1(sum.kcal),
                protein: round1(sum.protein),
                carbs: round1(sum.carbs),
                fat: round1(sum.fat),
                note,
              });
            }}
            className="w-full rounded-2xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-40"
          >
            Zatwierdź posiłek
          </motion.button>
        </>
      )}
    </div>
  );
}
