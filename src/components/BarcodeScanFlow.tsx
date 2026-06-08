import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, ScanLine, Image as ImageIcon, Flashlight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { type Meal, MEAL_LABEL, usePlate } from "@/lib/store";

const MEALS: Meal[] = ["breakfast", "second_breakfast", "lunch", "dinner", "snack"];

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
    fiber_g?: number | null;
    sugars_g?: number | null;
    saturated_fat_g?: number | null;
    sodium_mg?: number | null;
  }) => void;
}

interface OFFProduct {
  name: string;
  // per 100 g
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number | null;
  sugars_g: number | null;
  saturated_fat_g: number | null;
  sodium_mg: number | null;
  // serving
  servingGrams: number | null;
  servingValues: {
    kcal: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber_g: number | null;
    sugars_g: number | null;
    saturated_fat_g: number | null;
    sodium_mg: number | null;
  } | null;
}

type Phase = "scan" | "loading" | "review" | "notfound" | "neterror" | "fatal";

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseLeadingNumber(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = s.match(/([\d]+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function fetchOpenFoodFacts(barcode: string): Promise<OFFProduct | null> {
  const fields = [
    "product_name",
    "generic_name",
    "brands",
    "serving_size",
    "serving_quantity",
    "nutriments",
  ].join(",");
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode,
    )}.json?fields=${fields}`,
  );
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (json.status === 0 || !json.product) return null;
  const p = json.product;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;

  // kcal per 100 g (with kJ fallback)
  let kcal = numOrNull(n["energy-kcal_100g"]);
  if (kcal == null || kcal <= 0) {
    const kj = numOrNull(n["energy-kj_100g"]) ?? numOrNull(n["energy_100g"]);
    if (kj != null && kj > 0) kcal = kj / 4.184;
  }
  const protein = numOrNull(n["proteins_100g"]);
  const carbs = numOrNull(n["carbohydrates_100g"]);
  const fat = numOrNull(n["fat_100g"]);
  const fiber = numOrNull(n["fiber_100g"]);
  const sugars = numOrNull(n["sugars_100g"]);
  const satFat = numOrNull(n["saturated-fat_100g"]);

  // Sodium: OFF gives grams. Fallback via salt = sodium * 2.5
  let sodiumG = numOrNull(n["sodium_100g"]);
  if (sodiumG == null) {
    const saltG = numOrNull(n["salt_100g"]);
    if (saltG != null) sodiumG = saltG / 2.5;
  }
  const sodiumMg = sodiumG != null ? sodiumG * 1000 : null;

  // serving grams
  let servingGrams = numOrNull(p.serving_quantity);
  if (servingGrams == null) servingGrams = parseLeadingNumber(p.serving_size);

  // serving values (already absolute per serving)
  let servingKcal = numOrNull(n["energy-kcal_serving"]);
  if (servingKcal == null) {
    const kj = numOrNull(n["energy-kj_serving"]) ?? numOrNull(n["energy_serving"]);
    if (kj != null) servingKcal = kj / 4.184;
  }
  let sodiumServingG = numOrNull(n["sodium_serving"]);
  if (sodiumServingG == null) {
    const saltS = numOrNull(n["salt_serving"]);
    if (saltS != null) sodiumServingG = saltS / 2.5;
  }
  const servingValues =
    servingGrams != null && servingGrams > 0
      ? {
          kcal: servingKcal,
          protein: numOrNull(n["proteins_serving"]),
          carbs: numOrNull(n["carbohydrates_serving"]),
          fat: numOrNull(n["fat_serving"]),
          fiber_g: numOrNull(n["fiber_serving"]),
          sugars_g: numOrNull(n["sugars_serving"]),
          saturated_fat_g: numOrNull(n["saturated-fat_serving"]),
          sodium_mg: sodiumServingG != null ? sodiumServingG * 1000 : null,
        }
      : null;

  const baseName = (p.product_name || p.generic_name || "Produkt").toString().trim();
  const brand = (p.brands || "").toString().split(",")[0]?.trim();
  const name = (brand && !baseName.toLowerCase().includes(brand.toLowerCase())
    ? `${brand} ${baseName}`
    : baseName
  ).slice(0, 80);

  return {
    name,
    kcal: round1(kcal ?? 0),
    protein: round1(protein ?? 0),
    carbs: round1(carbs ?? 0),
    fat: round1(fat ?? 0),
    fiber_g: fiber != null ? round1(fiber) : null,
    sugars_g: sugars != null ? round1(sugars) : null,
    saturated_fat_g: satFat != null ? round1(satFat) : null,
    sodium_mg: sodiumMg != null ? Math.round(sodiumMg) : null,
    servingGrams: servingGrams != null && servingGrams > 0 ? servingGrams : null,
    servingValues,
  };
}


// Loaded lazily so SSR / unsupported environments never touch the lib at import time.
type ZxingMod = typeof import("@zxing/browser");
type LibMod = typeof import("@zxing/library");
let zxingModPromise: Promise<{ z: ZxingMod; lib: LibMod }> | null = null;
function loadZxing() {
  if (!zxingModPromise) {
    zxingModPromise = Promise.all([import("@zxing/browser"), import("@zxing/library")]).then(
      ([z, lib]) => ({ z, lib }),
    );
  }
  return zxingModPromise;
}

function buildHints(lib: LibMod) {
  const { BarcodeFormat, DecodeHintType } = lib;
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

export function BarcodeScanFlow({ meal, setMeal, onSubmit }: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastHitRef = useRef<{ code: string; at: number } | null>(null);
  const [phase, setPhase] = useState<Phase>("scan");
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [product, setProduct] = useState<OFFProduct | null>(null);
  const [grams, setGrams] = useState("100");
  const [usePortion, setUsePortion] = useState(true);
  const [saveToLib, setSaveToLib] = useState(false);

  const [status, setStatus] = useState<string>(() => t("scan.aim"));
  const [flashHit, setFlashHit] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const addProduct = usePlate((s) => s.addProduct);

  const stopScanner = () => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* noop */
    }
    controlsRef.current = null;
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) {
        try {
          t.stop();
        } catch {
          /* noop */
        }
      }
      streamRef.current = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch {
      toast.error(t("scan.torchUnavail"));
    }
  };

  const lookup = async (code: string) => {
    setBarcode(code);
    setStatus(t("scan.searching"));
    setPhase("loading");
    try {
      const p = await fetchOpenFoodFacts(code);
      if (!p) {
        setPhase("notfound");
        return;
      }
      setProduct(p);
      if (p.servingGrams != null && p.servingGrams > 0) {
        setUsePortion(true);
        setGrams(String(Math.round(p.servingGrams * 10) / 10));
      } else {
        setUsePortion(false);
        setGrams("100");
      }
      setPhase("review");

    } catch {
      setPhase("neterror");
    }
  };

  // start live camera scanner — client only
  useEffect(() => {
    if (phase !== "scan") return;
    if (typeof window === "undefined") return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      setScannerError(t("scan.cameraUnavail"));
      return;
    }

    let cancelled = false;
    setScannerError(null);
    setStatus(t("scan.aim"));
    lastHitRef.current = null;

    const v = videoRef.current;
    if (v) {
      v.setAttribute("playsinline", "true");
      v.setAttribute("webkit-playsinline", "true");
      v.setAttribute("autoplay", "true");
      v.setAttribute("muted", "true");
      v.muted = true;
    }

    (async () => {
      try {
        const { z, lib } = await loadZxing();
        if (cancelled || !videoRef.current) return;

        const reader = new z.BrowserMultiFormatReader(buildHints(lib), {
          delayBetweenScanAttempts: 120,
        });

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          },
          videoRef.current,
          (result, _err, ctrl) => {
            if (cancelled) return;
            if (!result) return;
            const code = result.getText().trim();
            if (!code) return;
            const now = Date.now();
            const last = lastHitRef.current;
            if (last && last.code === code && now - last.at < 2000) return;
            lastHitRef.current = { code, at: now };
            setFlashHit(true);
            try {
              navigator.vibrate?.(10);
            } catch {
              /* noop */
            }
            setTimeout(() => setFlashHit(false), 250);
            try {
              ctrl.stop();
            } catch {
              /* noop */
            }
            controlsRef.current = null;
            void lookup(code);
          },
        );

        if (cancelled) {
          try { controls.stop(); } catch { /* noop */ }
          return;
        }
        controlsRef.current = controls;

        // Capture stream from the video element to enable torch / cleanup
        const stream = (videoRef.current.srcObject as MediaStream | null) ?? null;
        if (stream) {
          streamRef.current = stream;
          const track = stream.getVideoTracks()[0];
          // continuous autofocus — best effort, never crash
          if (track) {
            try {
              await track.applyConstraints({
                advanced: [
                  { focusMode: "continuous" } as unknown as MediaTrackConstraintSet,
                ],
              });
            } catch {
              /* device doesn't support — ignore */
            }
            try {
              const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
                torch?: boolean;
              };
              if (caps.torch) setTorchSupported(true);
            } catch {
              /* noop */
            }
          }
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const err = e as { name?: string; message?: string };
        let msg = "Nie udało się uruchomić skanera — dodaj ręcznie.";
        if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
          msg = "Brak dostępu do kamery — sprawdź uprawnienia lub dodaj ręcznie.";
        } else if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
          msg = "Nie znaleziono kamery — dodaj ręcznie.";
        } else if (err?.name === "NotReadableError") {
          msg = "Kamera jest używana przez inną aplikację.";
        }
        setScannerError(msg);
      }
    })();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [phase]);

  // Always release camera when component unmounts
  useEffect(() => () => stopScanner(), []);

  const onFileFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setPhase("loading");
    try {
      const { z, lib } = await loadZxing();
      const url = URL.createObjectURL(file);
      const reader = new z.BrowserMultiFormatReader(buildHints(lib));
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
    setUsePortion(true);

    setScannerError(null);
    setPhase("scan");
  };

  // Catch-all render guard so a child throw doesn't bubble to the app shell
  try {
    if (fatalError) {
      return (
        <div className="space-y-3 py-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-foreground/10">
            <AlertTriangle size={20} />
          </div>
          <div className="text-sm font-semibold">Nie udało się uruchomić skanera</div>
          <p className="text-xs text-muted-foreground">{fatalError}</p>
          <ManualFallback meal={meal} setMeal={setMeal} onSubmit={onSubmit} onCancel={() => { setFatalError(null); reset(); }} />
        </div>
      );
    }

    if (phase === "scan") {
    return (
      <div className="space-y-3">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            {...({ "webkit-playsinline": "true" } as Record<string, string>)}
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Scanner frame overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{
                boxShadow: flashHit
                  ? "0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 3px #4ade80"
                  : "0 0 0 9999px rgba(0,0,0,0.55)",
              }}
              transition={{ duration: 0.15 }}
              className="relative h-[55%] w-[80%] rounded-xl"
            >
              {(["-top-px left-0 border-l-2 border-t-2 rounded-tl-xl",
                 "-top-px right-0 border-r-2 border-t-2 rounded-tr-xl",
                 "-bottom-px left-0 border-b-2 border-l-2 rounded-bl-xl",
                 "-bottom-px right-0 border-b-2 border-r-2 rounded-br-xl"] as const).map((c) => (
                <div
                  key={c}
                  className={`absolute h-6 w-6 ${c}`}
                  style={{ borderColor: flashHit ? "#4ade80" : "var(--accent-yellow)" }}
                />
              ))}
              <motion.div
                initial={{ top: "10%" }}
                animate={{ top: ["10%", "90%", "10%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-2 right-2 h-0.5 rounded-full"
                style={{
                  background: "var(--accent-yellow)",
                  boxShadow: "0 0 12px color-mix(in oklab, var(--accent-yellow) 70%, transparent)",
                }}
              />
            </motion.div>
          </div>

          {torchSupported && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label="Latarka"
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full backdrop-blur"
              style={{
                background: torchOn ? "var(--accent-yellow)" : "rgba(0,0,0,0.45)",
                color: torchOn ? "#1A1A18" : "#FFFFFF",
              }}
            >
              <Flashlight size={16} strokeWidth={1.8} />
            </button>
          )}

          {scannerError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 px-4 text-center text-xs text-white">
              <ScanLine size={20} />
              <div>{scannerError}</div>
            </div>
          )}
        </div>

        <p
          className="text-center text-[12px]"
          style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
        >
          {status}
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

        {scannerError && (
          <ManualFallback meal={meal} setMeal={setMeal} onSubmit={onSubmit} onCancel={reset} />
        )}

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
  const hasServing = product.servingGrams != null && product.servingGrams > 0;
  const sg = product.servingGrams ?? 0;
  // When the user has the "Porcja" toggle on AND the grams equal the serving grams,
  // prefer OFF's _serving values for each field where present.
  const usingServingValues =
    usePortion &&
    hasServing &&
    Math.abs(g - sg) < 0.001 &&
    product.servingValues != null;
  const sv = product.servingValues;
  const pickPer100 = (per100: number | null, servingVal: number | null) => {
    if (usingServingValues && servingVal != null) return servingVal;
    return per100 != null ? per100 * factor : 0;
  };
  const totals = {
    kcal: round1(pickPer100(product.kcal, sv?.kcal ?? null)),
    protein: round1(pickPer100(product.protein, sv?.protein ?? null)),
    carbs: round1(pickPer100(product.carbs, sv?.carbs ?? null)),
    fat: round1(pickPer100(product.fat, sv?.fat ?? null)),
  };
  const extras = {
    fiber_g:
      product.fiber_g == null
        ? null
        : round1(pickPer100(product.fiber_g, sv?.fiber_g ?? null)),
    sugars_g:
      product.sugars_g == null
        ? null
        : round1(pickPer100(product.sugars_g, sv?.sugars_g ?? null)),
    saturated_fat_g:
      product.saturated_fat_g == null
        ? null
        : round1(pickPer100(product.saturated_fat_g, sv?.saturated_fat_g ?? null)),
    sodium_mg:
      product.sodium_mg == null
        ? null
        : Math.round(pickPer100(product.sodium_mg, sv?.sodium_mg ?? null)),
  };
  const complex =
    extras.sugars_g != null
      ? Math.max(0, round1(totals.carbs - extras.sugars_g))
      : null;
  const valid = product.name.trim().length > 0 && g > 0;
  const updatePer100 = (
    key: "kcal" | "protein" | "carbs" | "fat" | "fiber_g" | "sugars_g" | "saturated_fat_g" | "sodium_mg",
    value: string,
  ) => {
    const n = value.trim() === "" ? null : Number(value.replace(",", "."));
    const v = n == null || !Number.isFinite(n) ? null : n;
    setProduct({ ...product, [key]: v as number | null });
  };
  const togglePortion = (on: boolean) => {
    setUsePortion(on);
    if (on && hasServing) setGrams(String(Math.round(sg * 10) / 10));
    else setGrams("100");
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
            fiber_g: product.fiber_g ?? null,
            sugars_g: product.sugars_g ?? null,
            saturated_fat_g: product.saturated_fat_g ?? null,
            sodium_mg: product.sodium_mg ?? null,
          });
        }
        onSubmit({
          name: product.name.trim(),
          grams: g,
          kcal: totals.kcal,
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
          fiber_g: extras.fiber_g,
          sugars_g: extras.sugars_g,
          saturated_fat_g: extras.saturated_fat_g,
          sodium_mg: extras.sodium_mg,
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

      {hasServing && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-foreground/5 px-3 py-2">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Porcja: {sg} g <span className="opacity-60">(z bazy)</span>
          </span>
          <div className="flex gap-1 rounded-full bg-background/60 p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => togglePortion(true)}
              className={`rounded-full px-2.5 py-1 ${usePortion ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Porcja ({sg} g)
            </button>
            <button
              type="button"
              onClick={() => togglePortion(false)}
              className={`rounded-full px-2.5 py-1 ${!usePortion ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              100 g
            </button>
          </div>
        </div>
      )}

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
        <div className="mt-2 grid grid-cols-4 gap-2">
          <SmallField label="Błonnik" value={product.fiber_g == null ? "" : String(product.fiber_g)} onChange={(v) => updatePer100("fiber_g", v)} />
          <SmallField label="Cukry" value={product.sugars_g == null ? "" : String(product.sugars_g)} onChange={(v) => updatePer100("sugars_g", v)} />
          <SmallField label="Nasyc." value={product.saturated_fat_g == null ? "" : String(product.saturated_fat_g)} onChange={(v) => updatePer100("saturated_fat_g", v)} />
          <SmallField label="Sód mg" value={product.sodium_mg == null ? "" : String(product.sodium_mg)} onChange={(v) => updatePer100("sodium_mg", v)} />
        </div>
      </div>

      <Field label="Ile gramów zjadłeś/aś?">
        <input
          className={inputCls}
          inputMode="decimal"
          value={grams}
          onChange={(e) => { setGrams(e.target.value.replace(",", ".")); setUsePortion(false); }}
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
          {complex != null && (
            <div className="text-[11px] text-muted-foreground">
              w tym proste: {extras.sugars_g} g · złożone: {complex} g
            </div>
          )}
          {(extras.fiber_g != null || extras.saturated_fat_g != null || extras.sodium_mg != null) && (
            <div className="text-[11px] text-muted-foreground">
              {extras.fiber_g != null && <>Błonnik {extras.fiber_g} g · </>}
              {extras.saturated_fat_g != null && <>Nasyc. {extras.saturated_fat_g} g · </>}
              {extras.sodium_mg != null && <>Sód {extras.sodium_mg} mg</>}
            </div>
          )}
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

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!fatalError) {
      // Defer state update to next tick to avoid setState-in-render warning
      queueMicrotask(() => setFatalError(msg));
    }
    return (
      <div className="space-y-3 py-6 text-center">
        <div className="text-sm font-semibold">Nie udało się uruchomić skanera</div>
        <p className="text-xs text-muted-foreground">{msg}</p>
        <ManualFallback meal={meal} setMeal={setMeal} onSubmit={onSubmit} onCancel={reset} />
      </div>
    );
  }
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
