import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, MessageCircle, Mic, Send, Sparkles, X, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  askAssistant,
  type AssistantResult,
  type FoodAction,
  type RecognizedItem,
} from "@/lib/ai-assistant.functions";
import {
  defaultAssistantSettings,
  getDayGoals,
  type Meal,
  sumEntries,
  usePlate,
  ymd,
} from "@/lib/store";

interface Props {
  defaultMeal?: Meal;
  date?: string;
  onClose: () => void;
}

type HistoryItem =
  | { id: string; kind: "user"; text: string; previews?: string[] }
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "actions"; text: string; actions: FoodAction[] };

const MAX_IMAGES = 5;

function nid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function shrinkImage(file: File, maxDim = 1280, quality = 0.8): Promise<string> {
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

function guessMeal(): Meal {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 12) return "second_breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

export function AssistantFlow({ defaultMeal, date }: Props) {
  const { t } = useTranslation();
  const mealLabel = (m: Meal) => t(`meal.${m}`);
  const CHIPS = [t("ai.chip1"), t("ai.chip2"), t("ai.chip3")];
  const targetDate = date ?? ymd(new Date());
  const profile = usePlate((s) => s.profile);
  const entries = usePlate((s) => s.entries);
  const burnedMap = usePlate((s) => s.burned);
  const addEntry = usePlate((s) => s.addEntry);
  const assistantSettings = profile.assistant ?? defaultAssistantSettings;
  const effectiveDefaultMeal: Meal | undefined =
    defaultMeal ?? (assistantSettings.defaultMeal !== "auto" ? assistantSettings.defaultMeal : undefined);

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState<false | "text" | "image">(false);
  const [pendingImages, setPendingImages] = useState<{ dataUrl: string; base64: string }[]>([]);
  const [preview, setPreview] = useState<null | {
    dishName: string;
    meal: Meal;
    items: RecognizedItem[];
    notes?: string;
    previews: string[];
  }>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const ask = useServerFn(askAssistant);

  const getLang = (): "pl" | "en" => {
    if (typeof window === "undefined") return "pl";
    const v = window.localStorage.getItem("app_language");
    return v === "en" ? "en" : "pl";
  };

  // ── Speech recognition (Web Speech API) ──
  const [listening, setListening] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) setSttSupported(true);
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* noop */
      }
    };
  }, []);

  const toggleMic = () => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* noop */
      }
      return;
    }
    try {
      const rec = new SR();
      rec.lang = "pl-PL";
      rec.interimResults = true;
      rec.continuous = true;
      baseInputRef.current = input ? input.trimEnd() + " " : "";
      rec.onresult = (event: any) => {
        let interim = "";
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) finalText += res[0].transcript;
          else interim += res[0].transcript;
        }
        const combined = baseInputRef.current + finalText + interim;
        setInput(combined);
        if (finalText) {
          baseInputRef.current = baseInputRef.current + finalText;
        }
      };
      rec.onerror = (e: any) => {
        setListening(false);
        const err = e?.error;
        if (err === "not-allowed" || err === "service-not-allowed") {
          toast.error(t("ai.voice.notAllowed"));
        } else if (err === "no-speech") {
          toast.message(t("ai.voice.noSpeech"));
        } else if (err === "network") {
          toast.error(t("ai.voice.network"));
        } else if (err && err !== "aborted") {
          toast.error(t("ai.toast.recognitionFail"));
        }
      };
      rec.onend = () => {
        setListening(false);
        setTimeout(() => textareaRef.current?.focus(), 0);
      };
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      toast.error(t("ai.toast.micFail"));
    }
  };



  const dayContext = useMemo(() => {
    const day = entries.filter((e) => e.date === targetDate);
    const sum = sumEntries(day);
    const goals = getDayGoals(profile, targetDate);
    const burned = burnedMap[targetDate] ?? 0;
    const kcalGoal = profile.include_burned ? goals.kcal + burned : goals.kcal;
    return {
      date: targetDate,
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
        meal: e.meal, name: e.name, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat,
      })),
    };
  }, [profile, entries, burnedMap, targetDate]);

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

  const sendImages = async (
    imgs: { dataUrl: string; base64: string }[],
    note: string,
  ) => {
    const trimmedNote = note.trim();
    const userText = trimmedNote
      ? t("ai.userTextImagesWithNote", { n: imgs.length, note: trimmedNote })
      : t("ai.userTextImages", { n: imgs.length });
    setHistory((h) => [
      ...h,
      { id: nid(), kind: "user", text: userText, previews: imgs.map((i) => i.dataUrl) },
    ]);
    setBusy("image");
    try {
      const result = (await ask({
        data: {
          message: trimmedNote || t("ai.fallbackRecognize"),
          history: [],
          dayContext,
          images: imgs.map((i) => i.base64),
          settings: assistantSettings,
          lang: getLang(),
        },
      })) as AssistantResult;
      if (result.kind === "items") {
        setPreview({
          dishName: result.dishName || t("ai.fallbackDish"),
          meal: effectiveDefaultMeal ?? result.meal ?? guessMeal(),
          items: result.items,
          notes: result.notes,
          previews: imgs.map((i) => i.dataUrl),
        });
      } else if (result.kind === "text") {
        setHistory((h) => [...h, { id: nid(), kind: "text", text: result.text }]);
      } else {
        setHistory((h) => [...h, { id: nid(), kind: "text", text: t("ai.history.noItems") }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("AI_RATE_LIMIT")) toast.error(t("ai.toast.rate"));
      else if (msg.includes("AI_CREDITS")) toast.error(t("ai.toast.credits"));
      else toast.error(t("ai.toast.imageFail"));
    } finally {
      setBusy(false);
    }
  };

  const sendText = async (message: string) => {
    const trimmed = message.trim();
    if (busy) return;
    if (pendingImages.length > 0) {
      const imgs = pendingImages;
      setPendingImages([]);
      setInput("");
      await sendImages(imgs, trimmed);
      return;
    }
    if (!trimmed) return;
    setInput("");
    setHistory((h) => [...h, { id: nid(), kind: "user", text: trimmed }]);
    setBusy("text");
    try {
      const result = (await ask({
        data: {
          message: trimmed,
          history: sessionHistory,
          dayContext,
          settings: assistantSettings,
          lang: getLang(),
        },
      })) as AssistantResult;

      if (result.kind === "actions") {
        for (const a of result.actions) {
          addEntry({
            date: targetDate,
            meal: a.meal, name: a.name,
            grams: a.grams ?? undefined,
            kcal: a.kcal, protein: a.protein, carbs: a.carbs, fat: a.fat,
          });
        }
        setHistory((h) => [
          ...h,
          { id: nid(), kind: "actions", text: result.text, actions: result.actions },
        ]);
      } else if (result.kind === "text") {
        setHistory((h) => [...h, { id: nid(), kind: "text", text: result.text }]);
      } else {
        setHistory((h) => [...h, { id: nid(), kind: "text", text: t("ai.history.noAnswer") }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("AI_RATE_LIMIT")) toast.error(t("ai.toast.rate"));
      else if (msg.includes("AI_CREDITS")) toast.error(t("ai.toast.credits"));
      else if (msg.includes("GEMINI_KEY_MISSING")) toast.error(t("ai.toast.geminiKey"));
      else toast.error(t("ai.toast.textFail"));
      setHistory((h) => [
        ...h,
        { id: nid(), kind: "text", text: t("ai.history.fail") },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onPickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = "";
    if (files.length === 0 || busy) return;
    const slotsLeft = MAX_IMAGES - pendingImages.length;
    if (slotsLeft <= 0) {
      toast.message(`Maks. ${MAX_IMAGES} zdjęć.`);
      return;
    }
    const toAdd = files.slice(0, slotsLeft);
    const results: { dataUrl: string; base64: string }[] = [];
    for (const f of toAdd) {
      try {
        const dataUrl = await shrinkImage(f);
        results.push({ dataUrl, base64: dataUrl.split(",")[1] ?? "" });
      } catch {
        toast.error("Nie udało się wczytać zdjęcia.");
      }
    }
    if (results.length > 0) setPendingImages((p) => [...p, ...results]);
  };

  const handleAddPreview = (oneEntry: boolean) => {
    if (!preview) return;
    const { items, meal, dishName, previews } = preview;
    if (items.length === 0) return;

    const addedIds: string[] = [];

    if (oneEntry) {
      const total = items.reduce(
        (acc, it) => ({
          kcal: acc.kcal + it.kcal,
          protein: acc.protein + it.protein,
          carbs: acc.carbs + it.carbs,
          fat: acc.fat + it.fat,
          grams: acc.grams + it.grams,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 },
      );
      const id = nid();
      addedIds.push(id);
      addEntry({
        date: targetDate,
        meal,
        name: dishName || "Posiłek",
        grams: Math.round(total.grams) || undefined,
        kcal: Math.round(total.kcal),
        protein: Math.round(total.protein * 10) / 10,
        carbs: Math.round(total.carbs * 10) / 10,
        fat: Math.round(total.fat * 10) / 10,
      });
    } else {
      for (const it of items) {
        addEntry({
          date: targetDate,
          meal,
          name: it.name,
          grams: Math.round(it.grams) || undefined,
          kcal: Math.round(it.kcal),
          protein: Math.round(it.protein * 10) / 10,
          carbs: Math.round(it.carbs * 10) / 10,
          fat: Math.round(it.fat * 10) / 10,
        });
      }
    }

    // Snapshot for undo
    const snapshot = oneEntry
      ? [
          {
            name: dishName || "Posiłek",
            meal,
            grams: items.reduce((a, b) => a + b.grams, 0),
            kcal: items.reduce((a, b) => a + b.kcal, 0),
            protein: items.reduce((a, b) => a + b.protein, 0),
            carbs: items.reduce((a, b) => a + b.carbs, 0),
            fat: items.reduce((a, b) => a + b.fat, 0),
          },
        ]
      : items.map((it) => ({ ...it, meal }));

    const removeLast = usePlate.getState();
    const totalAdded = oneEntry ? 1 : items.length;
    // Capture last N entries on the day with these names to undo
    const after = removeLast.entries.filter((e) => e.date === targetDate).slice(-totalAdded);
    const undoIds = after.map((e) => e.id);

    setPreview(null);
    setHistory((h) => [
      ...h,
      {
        id: nid(),
        kind: "text",
        text: oneEntry
          ? t("ai.history.addedOne", { name: dishName || t("ai.fallbackDish") })
          : t("ai.history.addedMany", { n: items.length, name: dishName || t("ai.fallbackDish") }),
      },
    ]);

    toast(t("ai.toast.added", { meal: mealLabel(meal) }), {
      duration: 5000,
      action: {
        label: t("ai.toast.undo"),
        onClick: () => {
          const rm = usePlate.getState().removeEntry;
          for (const id of undoIds) rm(id);
        },
      },
    });
    void snapshot;
    void previews;
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPickImages}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPickImages}
      />

      {pendingImages.length > 0 && (
        <div
          className="flex items-center gap-2 overflow-x-auto rounded-2xl bg-card p-2"
          style={{ border: "1px solid var(--hairline)", boxShadow: "var(--shadow-card)" }}
        >
          {pendingImages.map((img, i) => (
            <div key={i} className="relative shrink-0">
              <img src={img.dataUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))}
                disabled={!!busy}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full"
                style={{ background: "var(--ink)", color: "var(--card)" }}
                aria-label="Usuń zdjęcie"
              >
                <X size={11} strokeWidth={2.4} />
              </button>
            </div>
          ))}
          {pendingImages.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={!!busy}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-xl"
              style={{ background: "var(--muted)", color: "var(--ink)" }}
              aria-label="Dodaj kolejne"
            >
              <Plus size={18} strokeWidth={2.2} />
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendText(input);
        }}
        className="flex items-end gap-2"
      >
        <div
          className="flex flex-1 items-end gap-2 rounded-[22px] bg-card px-4 py-3"
          style={{ border: "1px solid var(--hairline)", boxShadow: "var(--shadow-card)" }}
        >
          <textarea
            ref={textareaRef}
            autoFocus
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendText(input);
              }
            }}
            placeholder={
              pendingImages.length > 0
                ? "Opisz ilości (np. 100 g ryżu, 1 całe opakowanie)…"
                : "Opisz co zjadłeś albo zapytaj…"
            }
            disabled={!!busy}
            className="flex-1 resize-none bg-transparent text-[15px] leading-snug outline-none max-h-32 overflow-y-auto placeholder:text-[color:var(--muted-foreground)]"
            style={{ color: "var(--ink)", fontWeight: 500 }}
          />
          <button
            type="submit"
            disabled={(!input.trim() && pendingImages.length === 0) || !!busy}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full disabled:opacity-40"
            style={{ background: "var(--ink)", color: "var(--card)" }}
            aria-label="Wyślij"
          >
            <Send size={14} strokeWidth={2} />
          </button>
        </div>
        {sttSupported && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={!!busy}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] disabled:opacity-40"
            style={{
              background: listening ? "#FF3B30" : "var(--card)",
              color: listening ? "#fff" : "var(--ink)",
              border: "1px solid var(--hairline)",
              boxShadow: "var(--shadow-card)",
              animation: listening ? "pulse 1.2s ease-in-out infinite" : undefined,
            }}
            aria-label={listening ? "Zatrzymaj nasłuch" : "Dyktuj głosem"}
          >
            <Mic size={18} strokeWidth={1.9} />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (pendingImages.length >= MAX_IMAGES) {
              toast.message(`Maks. ${MAX_IMAGES} zdjęć.`);
              return;
            }
            fileRef.current?.click();
          }}
          disabled={!!busy}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] disabled:opacity-40"
          style={{
            background: pendingImages.length > 0 ? "var(--accent-yellow)" : "var(--card)",
            color: "var(--ink)",
            border: "1px solid var(--hairline)",
            boxShadow: "var(--shadow-card)",
          }}
          aria-label="Dodaj zdjęcia"
        >
          <Camera size={18} strokeWidth={1.9} />
        </button>
      </form>

      {history.length === 0 && !busy && (
        <div
          className="rounded-2xl bg-card p-4 text-sm"
          style={{ border: "1px solid var(--hairline)", boxShadow: "var(--shadow-card)" }}
        >
          <div
            className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider"
            style={{ color: "var(--muted-foreground)", fontWeight: 700 }}
          >
            <MessageCircle size={12} strokeWidth={1.9} /> Mogę pomóc na 3 sposoby
          </div>
          <ul className="space-y-1.5 text-[13px] leading-snug" style={{ color: "var(--ink)" }}>
            <li className="flex gap-2">
              <Sparkles size={14} strokeWidth={1.9} className="mt-0.5 shrink-0" style={{ color: "var(--accent-yellow)" }} />
              <span><b>Opisz co zjadłeś</b> — dodam z makro</span>
            </li>
            <li className="flex gap-2">
              <Camera size={14} strokeWidth={1.9} className="mt-0.5 shrink-0" style={{ color: "var(--accent-yellow)" }} />
              <span><b>Dodaj zdjęcia etykiet</b> (do 5) i opisz ilości</span>
            </li>
            <li className="flex gap-2">
              <MessageCircle size={14} strokeWidth={1.9} className="mt-0.5 shrink-0" style={{ color: "var(--accent-yellow)" }} />
              <span><b>Zapytaj o makro</b> — ile zostało, co dojeść</span>
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
            className="rounded-full px-3.5 py-1.5 text-[12px] transition active:scale-95 disabled:opacity-40"
            style={{ background: "var(--hairline)", color: "var(--ink)", fontWeight: 600 }}
          >
            {c}
          </button>
        ))}
      </div>

      {busy && (
        <div
          className="flex items-center gap-2 px-1 text-[12px]"
          style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
        >
          <Loader2 size={12} className="animate-spin" />
          {busy === "image" ? "Analizuję zdjęcia…" : "Myślę…"}
        </div>
      )}

      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {history
          .slice()
          .reverse()
          .map((it) => (
            <HistoryRow key={it.id} item={it} />
          ))}
      </div>

      <AnimatePresence>
        {preview && (
          <ItemsPreviewSheet
            data={preview}
            onClose={() => setPreview(null)}
            onChange={setPreview}
            onAdd={handleAddPreview}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const { t } = useTranslation();
  if (item.kind === "user") {
    return (
      <div className="ml-auto max-w-[80%] space-y-1">
        {item.previews && item.previews.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1">
            {item.previews.map((p, i) => (
              <img key={i} src={p} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ))}
          </div>
        )}
        <div
          className="rounded-2xl px-3.5 py-2 text-[14px]"
          style={{ background: "var(--ink)", color: "var(--card)", fontWeight: 500 }}
        >
          {item.text}
        </div>
      </div>
    );
  }
  if (item.kind === "text") {
    return (
      <div
        className="max-w-[90%] rounded-2xl bg-card px-3.5 py-2.5 text-[14px]"
        style={{
          border: "1px solid var(--hairline)",
          boxShadow: "var(--shadow-card)",
          color: "var(--ink)",
          fontWeight: 500,
        }}
      >
        {item.text}
      </div>
    );
  }
  // actions
  return (
    <div
      className="rounded-2xl bg-card p-3"
      style={{ border: "1px solid var(--hairline)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="text-[14px]" style={{ color: "var(--ink)", fontWeight: 500 }}>
        {item.text}
      </div>
      <div className="mt-2 space-y-1">
        {item.actions.map((a, i) => (
          <div
            key={i}
            className="num-tight flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs"
            style={{ background: "var(--hairline)", color: "var(--ink)" }}
          >
            <span className="truncate">
              <b>{a.name}</b>{" "}
              <span style={{ color: "var(--muted-foreground)" }}>· {t(`meal.${a.meal}`)}</span>
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              {Math.round(a.kcal)} kcal · {t("macro.short.protein")}{Math.round(a.protein)} {t("macro.short.carbs")}{Math.round(a.carbs)} {t("macro.short.fat")}{Math.round(a.fat)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MEAL_PILLS: Meal[] = ["breakfast", "second_breakfast", "lunch", "dinner", "snack"];

function ItemsPreviewSheet({
  data,
  onClose,
  onChange,
  onAdd,
}: {
  data: {
    dishName: string;
    meal: Meal;
    items: RecognizedItem[];
    notes?: string;
    previews: string[];
  };
  onClose: () => void;
  onChange: (next: typeof data) => void;
  onAdd: (oneEntry: boolean) => void;
}) {
  const { t } = useTranslation();
  const [oneEntry, setOneEntry] = useState(false);

  const sum = data.items.reduce(
    (a, it) => ({
      kcal: a.kcal + (Number(it.kcal) || 0),
      protein: a.protein + (Number(it.protein) || 0),
      carbs: a.carbs + (Number(it.carbs) || 0),
      fat: a.fat + (Number(it.fat) || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const setItem = (idx: number, patch: Partial<RecognizedItem>) => {
    onChange({ ...data, items: data.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  };
  const removeItem = (idx: number) => {
    onChange({ ...data, items: data.items.filter((_, i) => i !== idx) });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/40"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
        className="fixed inset-x-0 z-[61] mx-auto w-full max-w-[430px] overflow-hidden"
        style={{
          bottom: "var(--kb-inset, 0px)",
          background: "var(--card)",
          color: "var(--ink)",
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingBottom: "max(env(safe-area-inset-bottom),1rem)",
          boxShadow: "var(--shadow-card)",
          maxHeight: "calc(100dvh - var(--kb-inset, 0px) - 24px)",
        }}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div className="text-[18px]" style={{ fontWeight: 700 }}>{t("preview.title")}</div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full"
            style={{ background: "var(--muted)", color: "var(--ink)" }}
            aria-label={t("preview.close")}
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 pb-4" style={{ maxHeight: "70vh" }}>
          {/* SUMA */}
          <div
            className="rounded-[20px] p-3"
            style={{ background: "var(--muted)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                {t("preview.sum")}
              </span>
              <span className="num-tight text-[18px]" style={{ fontWeight: 800 }}>
                {Math.round(sum.kcal)} <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>kcal</span>
              </span>
            </div>
            <div className="num-tight mt-1 flex gap-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              <span>{t("macro.short.protein")} {sum.protein.toFixed(1)} g</span>
              <span>{t("macro.short.carbs")} {sum.carbs.toFixed(1)} g</span>
              <span>{t("macro.short.fat")} {sum.fat.toFixed(1)} g</span>
            </div>
          </div>

          {/* Dish name */}
          <Field label={t("preview.dishName")}>
            <input
              value={data.dishName}
              onChange={(e) => onChange({ ...data, dishName: e.target.value })}
              className="w-full bg-transparent text-[15px] outline-none"
              style={{ color: "var(--ink)", fontWeight: 600 }}
              placeholder={t("ai.fallbackDish")}
            />
          </Field>

          {/* Meal pills */}
          <div className="rounded-[20px] p-3" style={{ background: "var(--muted)" }}>
            <div
              className="pb-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t("preview.meal")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_PILLS.map((m) => {
                const active = data.meal === m;
                return (
                  <button
                    key={m}
                    onClick={() => onChange({ ...data, meal: m })}
                    className="rounded-full px-3 py-1.5 text-[12px] transition active:scale-95"
                    style={{
                      background: active ? "var(--ink)" : "var(--card)",
                      color: active ? "var(--card)" : "var(--ink)",
                      fontWeight: active ? 700 : 600,
                    }}
                  >
                    {t(`meal.${m}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {data.items.map((it, i) => (
              <ItemRow
                key={i}
                item={it}
                onChange={(patch) => setItem(i, patch)}
                onRemove={() => removeItem(i)}
              />
            ))}
            {data.items.length === 0 && (
              <div className="text-center text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                {t("preview.empty")}
              </div>
            )}
          </div>

          {data.notes && (
            <div
              className="rounded-xl px-3 py-2 text-[11px]"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              {data.notes}
            </div>
          )}

          {/* Toggle */}
          <button
            type="button"
            onClick={() => setOneEntry((v) => !v)}
            className="flex w-full items-center justify-between rounded-[20px] px-4 py-3"
            style={{ background: "var(--muted)", color: "var(--ink)" }}
          >
            <span className="text-[13px]" style={{ fontWeight: 600 }}>
              {t("preview.mergeOne")}
            </span>
            <span
              className="grid h-6 w-10 rounded-full p-0.5 transition"
              style={{ background: oneEntry ? "var(--accent-yellow)" : "var(--hairline)" }}
            >
              <span
                className="h-5 w-5 rounded-full bg-white transition"
                style={{ transform: oneEntry ? "translateX(16px)" : "translateX(0)" }}
              />
            </span>
          </button>

          <button
            onClick={() => onAdd(oneEntry)}
            disabled={data.items.length === 0}
            className="w-full rounded-full py-3 text-[14px] font-semibold disabled:opacity-40"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {t("preview.add")}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] p-3" style={{ background: "var(--muted)" }}>
      <div
        className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: RecognizedItem;
  onChange: (patch: Partial<RecognizedItem>) => void;
  onRemove: () => void;
}) {
  const num = (v: string) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  return (
    <div
      className="rounded-[20px] p-3"
      style={{ background: "var(--card)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start gap-2">
        <input
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="flex-1 bg-transparent text-[14px] outline-none"
          style={{ color: "var(--ink)", fontWeight: 700 }}
          placeholder="Nazwa"
        />
        <button
          onClick={onRemove}
          className="grid h-7 w-7 place-items-center rounded-full"
          style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
          aria-label="Usuń pozycję"
        >
          <X size={12} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        <MiniField label="g" value={item.grams} onChange={(v) => onChange({ grams: num(v) })} />
        <MiniField label="kcal" value={item.kcal} onChange={(v) => onChange({ kcal: num(v) })} bold />
        <MiniField label="B" value={item.protein} onChange={(v) => onChange({ protein: num(v) })} dot="var(--macro-protein)" />
        <MiniField label="W" value={item.carbs} onChange={(v) => onChange({ carbs: num(v) })} dot="var(--macro-carbs)" />
        <MiniField label="T" value={item.fat} onChange={(v) => onChange({ fat: num(v) })} dot="var(--macro-fat)" />
      </div>
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
  bold,
  dot,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  bold?: boolean;
  dot?: string;
}) {
  return (
    <div
      className="rounded-xl px-2 py-1.5"
      style={{ background: "var(--muted)" }}
    >
      <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>
        {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
        {label}
      </div>
      <input
        inputMode="decimal"
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="num-tight w-full bg-transparent text-[13px] outline-none"
        style={{ color: "var(--ink)", fontWeight: bold ? 800 : 600 }}
      />
    </div>
  );
}
