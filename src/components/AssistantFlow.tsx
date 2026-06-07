import { motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { Camera, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  askAssistant,
  type AssistantResult,
  type FoodAction,
  type ScannedLabel,
} from "@/lib/ai-assistant.functions";
import {
  getDayGoals,
  type Meal,
  MEAL_LABEL,
  sumEntries,
  usePlate,
  ymd,
} from "@/lib/store";

interface Props {
  defaultMeal?: Meal;
  onClose: () => void;
}

type HistoryItem =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "actions"; text: string; actions: FoodAction[] }
  | { id: string; kind: "label"; label: ScannedLabel; preview: string }
  | {
      id: string;
      kind: "meal";
      name: string;
      total: { kcal: number; protein: number; carbs: number; fat: number };
      confidence: number;
      preview: string;
    };

const CHIPS = ["Ile mi zostało?", "Co dojeść na białko?", "Dodaj posiłek"];

function nid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function shrinkImage(file: File, maxDim = 1024, quality = 0.8): Promise<string> {
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

export function AssistantFlow({ defaultMeal }: Props) {
  const today = ymd(new Date());
  const profile = usePlate((s) => s.profile);
  const entries = usePlate((s) => s.entries);
  const burnedMap = usePlate((s) => s.burned);
  const addEntry = usePlate((s) => s.addEntry);

  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState<false | "text" | "image">(false);
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; base64: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ask = useServerFn(askAssistant);

  const dayContext = useMemo(() => {
    const day = entries.filter((e) => e.date === today);
    const sum = sumEntries(day);
    const goals = getDayGoals(profile, today);
    const burned = burnedMap[today] ?? 0;
    const kcalGoal = profile.include_burned ? goals.kcal + burned : goals.kcal;
    return {
      date: today,
      hour: new Date().getHours(),
      goals: { kcal: kcalGoal, protein: goals.protein, carbs: goals.carbs, fat: goals.fat },
      consumed: sum,
      remaining: {
        kcal: kcalGoal - sum.kcal,
        protein: goals.protein - sum.protein,
        carbs: goals.carbs - sum.carbs,
        fat: goals.fat - sum.fat,
      },
      entries: day.map((e) => ({
        meal: e.meal,
        name: e.name,
        kcal: e.kcal,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
      })),
    };
  }, [profile, entries, burnedMap, today]);

  const sessionHistory = useMemo(
    () =>
      history
        .filter((h) => h.kind === "user" || h.kind === "text" || h.kind === "actions")
        .slice(-6)
        .map((h) =>
          h.kind === "user"
            ? { role: "user" as const, text: h.text }
            : { role: "model" as const, text: h.text },
        ),
    [history],
  );

  const sendImage = async (image: { dataUrl: string; base64: string }, note: string) => {
    const trimmedNote = note.trim();
    const userText = trimmedNote ? `📷 zdjęcie · "${trimmedNote}"` : "📷 zdjęcie";
    setHistory((h) => [...h, { id: nid(), kind: "user", text: userText }]);
    setBusy("image");
    try {
      const result = (await ask({
        data: {
          message: trimmedNote || "Rozpoznaj zdjęcie",
          history: [],
          dayContext,
          imageBase64: image.base64,
          mimeType: "image/jpeg",
        },
      })) as AssistantResult;
      if (result.kind === "label") {
        setHistory((h) => [
          ...h,
          { id: nid(), kind: "label", label: result.label, preview: image.dataUrl },
        ]);
      } else if (result.kind === "meal") {
        const m = defaultMeal ?? guessMeal();
        addEntry({
          date: today,
          meal: m,
          name: result.name || "Posiłek ze zdjęcia",
          kcal: Math.round(result.total.kcal * 10) / 10,
          protein: Math.round(result.total.protein * 10) / 10,
          carbs: Math.round(result.total.carbs * 10) / 10,
          fat: Math.round(result.total.fat * 10) / 10,
        });
        setHistory((h) => [
          ...h,
          {
            id: nid(),
            kind: "meal",
            name: result.name,
            total: result.total,
            confidence: result.confidence,
            preview: image.dataUrl,
          },
        ]);
      } else if (result.kind === "text") {
        setHistory((h) => [...h, { id: nid(), kind: "text", text: result.text }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("AI_RATE_LIMIT")) toast.error("Za dużo żądań, spróbuj za chwilę.");
      else if (msg.includes("AI_CREDITS")) toast.error("Brak kredytów AI / problem z kluczem.");
      else toast.error("Nie udało się rozpoznać zdjęcia.");
    } finally {
      setBusy(false);
    }
  };

  const sendText = async (message: string) => {
    const trimmed = message.trim();
    if (busy) return;
    if (pendingImage) {
      const img = pendingImage;
      setPendingImage(null);
      setInput("");
      await sendImage(img, trimmed);
      return;
    }
    if (!trimmed) return;
    setInput("");
    const userItem: HistoryItem = { id: nid(), kind: "user", text: trimmed };
    setHistory((h) => [...h, userItem]);
    setBusy("text");
    try {
      const result = (await ask({
        data: {
          message: trimmed,
          history: sessionHistory,
          dayContext,
        },
      })) as AssistantResult;

      if (result.kind === "actions") {
        for (const a of result.actions) {
          addEntry({
            date: today,
            meal: a.meal,
            name: a.name,
            grams: a.grams ?? undefined,
            kcal: a.kcal,
            protein: a.protein,
            carbs: a.carbs,
            fat: a.fat,
          });
        }
        setHistory((h) => [
          ...h,
          { id: nid(), kind: "actions", text: result.text, actions: result.actions },
        ]);
      } else if (result.kind === "text") {
        setHistory((h) => [...h, { id: nid(), kind: "text", text: result.text }]);
      } else {
        setHistory((h) => [...h, { id: nid(), kind: "text", text: "Hmm, brak odpowiedzi." }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("AI_RATE_LIMIT")) toast.error("Za dużo żądań, spróbuj za chwilę.");
      else if (msg.includes("AI_CREDITS")) toast.error("Brak kredytów AI / problem z kluczem.");
      else if (msg.includes("GEMINI_KEY_MISSING")) toast.error("Brak klucza Gemini.");
      else toast.error("Nie udało się — spróbuj ponownie lub dodaj ręcznie.");
      setHistory((h) => [
        ...h,
        { id: nid(), kind: "text", text: "Nie udało się — spróbuj ponownie lub dodaj ręcznie." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file || busy) return;
    try {
      const dataUrl = await shrinkImage(file);
      const base64 = dataUrl.split(",")[1] ?? "";
      setPendingImage({ dataUrl, base64 });
    } catch {
      toast.error("Nie udało się wczytać zdjęcia.");
    }
  };


  const onAddLabel = (item: HistoryItem & { kind: "label" }, grams: number, meal: Meal) => {
    const per = item.label.per100;
    const kcal = (per.kcal ?? 0) * (grams / 100);
    const p = (per.protein ?? 0) * (grams / 100);
    const c = (per.carbs ?? 0) * (grams / 100);
    const f = (per.fat ?? 0) * (grams / 100);
    addEntry({
      date: today,
      meal,
      name: item.label.name || "Produkt z etykiety",
      grams,
      kcal: Math.round(kcal * 10) / 10,
      protein: Math.round(p * 10) / 10,
      carbs: Math.round(c * 10) / 10,
      fat: Math.round(f * 10) / 10,
    });
    setHistory((h) => [
      ...h,
      {
        id: nid(),
        kind: "text",
        text: `Dodano: ${item.label.name || "produkt"} (${grams} g) — ${Math.round(kcal)} kcal.`,
      },
    ]);
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPickImage}
      />

      {pendingImage && (
        <div className="flex items-center gap-2 rounded-2xl bg-foreground/5 p-2">
          <img src={pendingImage.dataUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
          <div className="flex-1 text-xs text-muted-foreground">
            Zdjęcie gotowe. Możesz dodać opis (np. „duża porcja, ok. 300 g") albo wyślij od razu.
          </div>
          <button
            type="button"
            onClick={() => setPendingImage(null)}
            disabled={!!busy}
            className="grid h-7 w-7 place-items-center rounded-full bg-foreground/10"
            aria-label="Usuń zdjęcie"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendText(input);
        }}
        className="flex items-center gap-2"
      >
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2.5">
          <Sparkles size={16} className="text-primary shrink-0" />
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pendingImage
                ? "Dodaj opis do zdjęcia (opcjonalnie)…"
                : "Opisz co zjadłeś albo zapytaj o makro…"
            }
            disabled={!!busy}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
          <button
            type="submit"
            disabled={(!input.trim() && !pendingImage) || !!busy}
            className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Wyślij"
          >
            <Send size={14} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className={`grid h-11 w-11 place-items-center rounded-2xl disabled:opacity-40 ${
            pendingImage ? "bg-primary text-primary-foreground" : "bg-foreground/10"
          }`}
          aria-label="Zrób zdjęcie"
        >
          <Camera size={18} />
        </button>
      </form>

      {history.length === 0 && !busy && (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-3 text-sm">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <MessageCircle size={12} /> Mogę pomóc na 3 sposoby
          </div>
          <ul className="space-y-1 text-[13px] leading-snug text-foreground/85">
            <li className="flex gap-2">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-primary" />
              <span><b>Opisz co zjadłeś</b> — dodam z makro (np. „2 jajka i tost")</span>
            </li>
            <li className="flex gap-2">
              <Camera size={14} className="mt-0.5 shrink-0 text-primary" />
              <span><b>Zrób zdjęcie</b> posiłku lub etykiety — rozpoznam i dodam</span>
            </li>
            <li className="flex gap-2">
              <MessageCircle size={14} className="mt-0.5 shrink-0 text-primary" />
              <span><b>Zapytaj o makro</b> — ile Ci zostało, co dojeść na białko</span>
            </li>
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={!!busy}
            onClick={() => void sendText(c)}
            className="rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition active:scale-95 disabled:opacity-40"
          >
            {c}
          </button>
        ))}
      </div>

      {busy && (
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" />
          {busy === "image" ? "Analizuję zdjęcie…" : "Myślę…"}
        </div>
      )}

      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {history
          .slice()
          .reverse()
          .map((it) => (
            <HistoryRow key={it.id} item={it} onAddLabel={onAddLabel} defaultMeal={defaultMeal} />
          ))}
      </div>
    </div>
  );
}

function HistoryRow({
  item,
  onAddLabel,
  defaultMeal,
}: {
  item: HistoryItem;
  onAddLabel: (it: HistoryItem & { kind: "label" }, grams: number, meal: Meal) => void;
  defaultMeal?: Meal;
}) {
  if (item.kind === "user") {
    return (
      <div className="ml-auto max-w-[80%] rounded-2xl bg-primary/15 px-3 py-1.5 text-sm">
        {item.text}
      </div>
    );
  }
  if (item.kind === "text") {
    return (
      <div className="max-w-[90%] rounded-2xl bg-foreground/5 px-3 py-2 text-sm">{item.text}</div>
    );
  }
  if (item.kind === "actions") {
    return (
      <div className="rounded-2xl bg-foreground/5 p-3">
        <div className="text-sm">{item.text}</div>
        <div className="mt-2 space-y-1">
          {item.actions.map((a, i) => (
            <div
              key={i}
              className="num-tight flex items-center justify-between rounded-xl bg-card/80 px-2.5 py-1.5 text-xs"
            >
              <span className="truncate">
                <b>{a.name}</b>{" "}
                <span className="text-muted-foreground">· {MEAL_LABEL[a.meal]}</span>
              </span>
              <span className="text-muted-foreground">
                {Math.round(a.kcal)} kcal · B{Math.round(a.protein)} W{Math.round(a.carbs)} T
                {Math.round(a.fat)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (item.kind === "meal") {
    return (
      <div className="space-y-2 rounded-2xl bg-foreground/5 p-3">
        <div className="flex items-start gap-2">
          <img src={item.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
          <div className="flex-1">
            <div className="text-sm font-semibold">{item.name || "Posiłek"}</div>
            <div className="num-tight text-[11px] text-muted-foreground">
              szacunek: {Math.round(item.total.kcal)} kcal · B{Math.round(item.total.protein)} · W
              {Math.round(item.total.carbs)} · T{Math.round(item.total.fat)}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground/80">
              Dodano automatycznie (szacunek AI)
            </div>
          </div>
        </div>
      </div>
    );
  }
  return <LabelCard item={item} onAdd={onAddLabel} defaultMeal={defaultMeal} />;
}

function LabelCard({
  item,
  onAdd,
  defaultMeal,
}: {
  item: HistoryItem & { kind: "label" };
  onAdd: (it: HistoryItem & { kind: "label" }, grams: number, meal: Meal) => void;
  defaultMeal?: Meal;
}) {
  const [grams, setGrams] = useState("100");
  const [meal, setMeal] = useState<Meal>(defaultMeal ?? guessMeal());
  const [done, setDone] = useState(false);
  const g = Number(grams.replace(",", ".")) || 0;
  const per = item.label.per100;
  const factor = g / 100;
  const totals = {
    kcal: Math.round(((per.kcal ?? 0) * factor) * 10) / 10,
    p: Math.round(((per.protein ?? 0) * factor) * 10) / 10,
    c: Math.round(((per.carbs ?? 0) * factor) * 10) / 10,
    f: Math.round(((per.fat ?? 0) * factor) * 10) / 10,
  };
  if (done) {
    return (
      <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
        Dodano: {item.label.name || "produkt"} ({g} g)
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl bg-foreground/5 p-3">
      <div className="flex items-start gap-2">
        <img src={item.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{item.label.name || "Produkt z etykiety"}</div>
          <div className="num-tight text-[11px] text-muted-foreground">
            na 100 g: {per.kcal ?? "–"} kcal · B{per.protein ?? "–"} · W{per.carbs ?? "–"} · T
            {per.fat ?? "–"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex-1">
          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
            Gramy
          </span>
          <input
            inputMode="decimal"
            value={grams}
            onChange={(e) => setGrams(e.target.value.replace(",", "."))}
            className="num-tight w-full rounded-lg border border-border/60 bg-card px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex-1">
          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
            Posiłek
          </span>
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value as Meal)}
            className="w-full rounded-lg border border-border/60 bg-card px-2 py-1.5 text-sm"
          >
            {(Object.keys(MEAL_LABEL) as Meal[]).map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="num-tight text-xs text-muted-foreground">
        Razem: <b className="text-foreground">{totals.kcal}</b> kcal · B{totals.p} W{totals.c} T
        {totals.f}
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => {
          if (g <= 0) return;
          onAdd(item, g, meal);
          setDone(true);
        }}
        disabled={g <= 0}
        className="w-full rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        Dodaj do dziennika
      </motion.button>
    </div>
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
