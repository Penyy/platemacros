import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, ScanLine, Image as ImageIcon } from "lucide-react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { toast } from "sonner";
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

interface OFFProduct {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

type Phase = "scan" | "loading" | "review" | "notfound" | "neterror";

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

async function fetchOpenFoodFacts(barcode: string): Promise<OFFProduct | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
  );
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (json.status !== 1 || !json.product) return null;
  const p = json.product;
  const n = p.nutriments ?? {};
  let kcal = Number(n["energy-kcal_100g"]);
  if (!Number.isFinite(kcal) || kcal <= 0) {
    const kj = Number(n["energy_100g"]);
    if (Number.isFinite(kj) && kj > 0) kcal = kj / 4.184;
  }
  return {
    name: (p.product_name || p.generic_name || "Produkt").toString().trim().slice(0, 80),
    kcal: round1(Number.isFinite(kcal) ? kcal : 0),
    protein: round1(Number(n["proteins_100g"]) || 0),
    carbs: round1(Number(n["carbohydrates_100g"]) || 0),
    fat: round1(Number(n["fat_100g"]) || 0),
  };
}

export function BarcodeScanFlow({ meal, setMeal, onSubmit }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [phase, setPhase] = useState<Phase>("scan");
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [product, setProduct] = useState<OFFProduct | null>(null);
  const [grams, setGrams] = useState("100");
  const [saveToLib, setSaveToLib] = useState(false);
  const addProduct = usePlate((s) => s.addProduct);

  const stopScanner = () => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* noop */
    }
    controlsRef.current = null;
  };

  const lookup = async (code: string) => {
    setBarcode(code);
    setPhase("loading");
    try {
      const p = await fetchOpenFoodFacts(code);
      if (!p) {
        setPhase("notfound");
        return;
      }
      setProduct(p);
      setPhase("review");
    } catch {
      setPhase("neterror");
    }
  };

  // start live camera scanner
  useEffect(() => {
    if (phase !== "scan") return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    setScannerError(null);
    (async () => {
      try {
        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, _err, ctrl) => {
            if (cancelled) return;
            if (result) {
              const code = result.getText().trim();
              if (code) {
                ctrl.stop();
                controlsRef.current = null;
                void lookup(code);
              }
            }
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setScannerError(msg || "Brak dostępu do kamery");
      }
    })();
    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [phase]);

  const onFileFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setPhase("loading");
    try {
      const url = URL.createObjectURL(file);
      const reader = new BrowserMultiFormatReader();
      try {
        const result = await reader.decodeFromImageUrl(url);
        URL.revokeObjectURL(url);
        const code = result.getText().trim();
        if (!code) throw new Error("empty");
        await lookup(code);
      } catch {
        URL.revokeObjectURL(url);
        toast.error("Nie wykryto kodu na zdjęciu, spróbuj ponownie.");
        setPhase("scan");
      }
    } catch {
      toast.error("Nie udało się odczytać zdjęcia.");
      setPhase("scan");
    }
  };

  const reset = () => {
    stopScanner();
    setProduct(null);
    setBarcode(null);
    setGrams("100");
    setPhase("scan");
  };

  if (phase === "scan") {
    return (
      <div className="space-y-3">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Scanner frame overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[55%] w-[80%] rounded-xl">
              <div className="absolute -top-px left-0 h-6 w-6 rounded-tl-xl border-l-2 border-t-2 border-white" />
              <div className="absolute -top-px right-0 h-6 w-6 rounded-tr-xl border-r-2 border-t-2 border-white" />
              <div className="absolute -bottom-px left-0 h-6 w-6 rounded-bl-xl border-b-2 border-l-2 border-white" />
              <div className="absolute -bottom-px right-0 h-6 w-6 rounded-br-xl border-b-2 border-r-2 border-white" />
              <motion.div
                initial={{ top: "10%" }}
                animate={{ top: ["10%", "90%", "10%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-2 right-2 h-0.5 rounded-full bg-primary shadow-[0_0_12px_rgba(255,255,255,0.7)]"
              />
            </div>
          </div>
          {scannerError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center text-xs text-white">
              <ScanLine size={20} />
              <div>Brak dostępu do kamery. Użyj zdjęcia z galerii.</div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Wyceluj kamerę w kod kreskowy produktu
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFileFallback}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card py-3 text-sm font-semibold active:bg-accent"
        >
          <ImageIcon size={16} />
          Zrób zdjęcie kodu zamiast skanowania
        </button>

        <MealPicker meal={meal} setMeal={setMeal} />
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
        <div className="text-sm text-muted-foreground">Szukam produktu w bazie…</div>
        {barcode && (
          <div className="num-tight text-[11px] text-muted-foreground">Kod: {barcode}</div>
        )}
      </div>
    );
  }

  if (phase === "notfound") {
    return (
      <div className="space-y-3 py-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-foreground/10">
          <ScanLine size={20} />
        </div>
        <div className="text-sm font-semibold">Produktu nie ma w bazie</div>
        <p className="text-xs text-muted-foreground">
          Możesz wpisać dane ręcznie.
          {barcode ? <> Kod: <span className="num-tight">{barcode}</span></> : null}
        </p>
        <ManualFallback
          meal={meal}
          setMeal={setMeal}
          onSubmit={onSubmit}
          onCancel={reset}
        />
      </div>
    );
  }

  if (phase === "neterror") {
    return (
      <div className="space-y-3 py-8 text-center">
        <div className="text-sm font-semibold">Błąd połączenia</div>
        <p className="text-xs text-muted-foreground">
          Sprawdź internet i spróbuj ponownie.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mx-auto flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <RotateCcw size={14} /> Spróbuj ponownie
        </button>
      </div>
    );
  }

  // review
  if (!product) return null;
  const g = Math.max(0, Number(grams.replace(",", ".")) || 0);
  const factor = g / 100;
  const totals = {
    kcal: round1(product.kcal * factor),
    protein: round1(product.protein * factor),
    carbs: round1(product.carbs * factor),
    fat: round1(product.fat * factor),
  };
  const valid = product.name.trim().length > 0 && g > 0;
  const updatePer100 = (key: keyof Omit<OFFProduct, "name">, value: string) => {
    const n = Number(value.replace(",", ".")) || 0;
    setProduct({ ...product, [key]: n });
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        if (saveToLib) {
          addProduct({
            name: product.name.trim(),
            kcal: product.kcal,
            protein: product.protein,
            carbs: product.carbs,
            fat: product.fat,
          });
        }
        onSubmit({
          name: product.name.trim(),
          grams: g,
          kcal: totals.kcal,
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
        });
      }}
    >
      <div className="flex items-center justify-between">
        <div className="num-tight text-[11px] text-muted-foreground">
          Kod: {barcode}
        </div>
        <button
          type="button"
          onClick={reset}
          className="grid h-8 w-8 place-items-center rounded-full bg-foreground/10"
          aria-label="Skanuj ponownie"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <Field label="Nazwa">
        <input
          className={inputCls}
          value={product.name}
          maxLength={80}
          onChange={(e) => setProduct({ ...product, name: e.target.value })}
        />
      </Field>

      <div className="rounded-2xl bg-foreground/5 p-3">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Wartości na 100 g
        </div>
        <div className="grid grid-cols-4 gap-2">
          <SmallField label="kcal" value={String(product.kcal)} onChange={(v) => updatePer100("kcal", v)} />
          <SmallField label="B" value={String(product.protein)} onChange={(v) => updatePer100("protein", v)} />
          <SmallField label="W" value={String(product.carbs)} onChange={(v) => updatePer100("carbs", v)} />
          <SmallField label="T" value={String(product.fat)} onChange={(v) => updatePer100("fat", v)} />
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
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Razem</div>
          <div className="mt-0.5 text-sm">
            <span className="text-lg font-bold">{totals.kcal}</span> kcal · {g} g
          </div>
          <div className="text-xs text-muted-foreground">
            B {totals.protein} · W {totals.carbs} · T {totals.fat}
          </div>
        </div>
      )}

      <MealPicker meal={meal} setMeal={setMeal} />

      <label className="flex items-center gap-2 rounded-2xl bg-foreground/5 px-3 py-2.5 text-sm">
        <input
          type="checkbox"
          checked={saveToLib}
          onChange={(e) => setSaveToLib(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <span>Zapisz do moich produktów</span>
      </label>

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

function ManualFallback({
  meal,
  setMeal,
  onSubmit,
  onCancel,
}: {
  meal: Meal;
  setMeal: (m: Meal) => void;
  onSubmit: Props["onSubmit"];
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [grams, setGrams] = useState("100");
  const addProduct = usePlate((s) => s.addProduct);
  const [saveToLib, setSaveToLib] = useState(false);

  const g = Math.max(0, Number(grams.replace(",", ".")) || 0);
  const factor = g / 100;
  const per100 = {
    kcal: Number(kcal.replace(",", ".")) || 0,
    protein: Number(p.replace(",", ".")) || 0,
    carbs: Number(c.replace(",", ".")) || 0,
    fat: Number(f.replace(",", ".")) || 0,
  };
  const valid = name.trim() && per100.kcal > 0 && g > 0;

  return (
    <form
      className="space-y-3 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        if (saveToLib) addProduct({ name: name.trim(), ...per100 });
        onSubmit({
          name: name.trim(),
          grams: g,
          kcal: round1(per100.kcal * factor),
          protein: round1(per100.protein * factor),
          carbs: round1(per100.carbs * factor),
          fat: round1(per100.fat * factor),
        });
      }}
    >
      <Field label="Nazwa">
        <input className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="rounded-2xl bg-foreground/5 p-3">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Wartości na 100 g
        </div>
        <div className="grid grid-cols-4 gap-2">
          <SmallField label="kcal" value={kcal} onChange={setKcal} />
          <SmallField label="B" value={p} onChange={setP} />
          <SmallField label="W" value={c} onChange={setC} />
          <SmallField label="T" value={f} onChange={setF} />
        </div>
      </div>
      <Field label="Ile gramów">
        <input
          className={inputCls}
          inputMode="decimal"
          value={grams}
          onChange={(e) => setGrams(e.target.value.replace(",", "."))}
        />
      </Field>
      <MealPicker meal={meal} setMeal={setMeal} />
      <label className="flex items-center gap-2 rounded-2xl bg-foreground/5 px-3 py-2.5 text-sm">
        <input
          type="checkbox"
          checked={saveToLib}
          onChange={(e) => setSaveToLib(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <span>Zapisz do moich produktów</span>
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl bg-foreground/10 py-3 text-sm font-semibold"
        >
          Skanuj ponownie
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Dodaj
        </button>
      </div>
    </form>
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

// suppress unused import warning (Camera used elsewhere in similar flows)
void Camera;
