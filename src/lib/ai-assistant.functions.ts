import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ============================================================
// Types
// ============================================================

const MealEnum = z.enum(["breakfast", "second_breakfast", "lunch", "dinner", "snack"]);

const FoodActionSchema = z.object({
  meal: MealEnum,
  name: z.string().min(1).max(120),
  grams: z.number().min(0).max(5000).optional().nullable(),
  kcal: z.number().min(0).max(5000),
  protein: z.number().min(0).max(500),
  carbs: z.number().min(0).max(500),
  fat: z.number().min(0).max(500),
});
export type FoodAction = z.infer<typeof FoodActionSchema>;

const DayContextSchema = z.object({
  date: z.string(),
  hour: z.number().min(0).max(23),
  goals: z.object({
    kcal: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
  consumed: z.object({
    kcal: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
  remaining: z.object({
    kcal: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
  entries: z
    .array(
      z.object({
        meal: MealEnum,
        name: z.string(),
        kcal: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
      }),
    )
    .max(50),
});

const HistorySchema = z
  .array(
    z.object({
      role: z.enum(["user", "model"]),
      text: z.string().max(2000),
    }),
  )
  .max(10);

const SettingsSchema = z.object({
  autoAddPhoto: z.boolean().default(true),
  allowAddEntries: z.boolean().default(true),
  defaultMeal: z
    .enum(["auto", "breakfast", "second_breakfast", "lunch", "dinner", "snack"])
    .default("auto"),
  responseLength: z.enum(["short", "detailed"]).default("short"),
});
export type AssistantCallSettings = z.infer<typeof SettingsSchema>;

const AskInputSchema = z.object({
  message: z.string().max(2000),
  history: HistorySchema.optional().default([]),
  dayContext: DayContextSchema,
  // legacy single image (still supported — wrapped into images[])
  imageBase64: z.string().min(100).max(8_000_000).optional(),
  mimeType: z.string().optional(),
  // new: up to 5 images at once
  images: z.array(z.string().min(100).max(8_000_000)).max(5).optional(),
  settings: SettingsSchema.optional(),
  lang: z.enum(["pl", "en"]).optional().default("pl"),
});

type Lang = "pl" | "en";

function languageAddendum(lang: Lang): string {
  return lang === "en"
    ? "IMPORTANT: Respond in English. All user-facing text (replies, notes, item names) must be in English. EXCEPTION: the `meal` field MUST stay as the Polish enum (Śniadanie / Obiad / Kolacja / Przekąska) — it is a database value, not display text."
    : "WAŻNE: Odpowiadaj po polsku.";
}


// Output kinds
const MacrosSchema = z.object({
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

const PhotoSchema = z.object({
  type: z.enum(["etykieta", "posilek"]),
  name: z.string(),
  per100: MacrosSchema.nullable().optional(),
  total: MacrosSchema.nullable().optional(),
  confidence: z.number().min(0).max(1),
});
export type PhotoRecognition = z.infer<typeof PhotoSchema>;

// kept for back-compat with UI imports
export type ScannedLabel = {
  name: string;
  per100: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null };
  confidence: number;
};

export interface RecognizedItem {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type AssistantResult =
  | { kind: "text"; text: string }
  | { kind: "actions"; actions: FoodAction[]; text: string }
  | { kind: "label"; label: ScannedLabel }
  | { kind: "meal"; name: string; total: { kcal: number; protein: number; carbs: number; fat: number }; confidence: number }
  | {
      kind: "items";
      dishName: string;
      meal: Meal;
      items: RecognizedItem[];
      notes?: string;
      previews: string[];
    };

type Meal = "breakfast" | "second_breakfast" | "lunch" | "dinner" | "snack";


// ============================================================
// Prompts
// ============================================================

const ACCURACY_GUIDELINES = `DOKŁADNOŚĆ:
- Etykiety: rozróżniaj 'na 100 g/ml' vs 'na porcję'; kJ→kcal /4,184; g vs mg; sól = sód×2,5. Gdy etykieta podaje wartość — ufaj jej.
- Bez etykiety: rozpoznaj składniki, oszacuj gramaturę (naczynia/sztućce/opakowanie jako skala), licz per składnik i sumuj.
- OSTROŻNOŚĆ: przy niepewności bias ku GÓRNEJ granicy realistycznego zakresu (lepiej lekko przeszacować niż niedoszacować).
- SPÓJNOŚĆ: kcal ≈ 4×B + 4×W + 9×T (±10%). Przy etykiecie zachowaj wydrukowane kcal.
- Polskie przecinki dziesiętne. Zawsze zwróć najlepsze oszacowanie.`;

const SYSTEM_INSTRUCTION = `Jesteś asystentem żywieniowym Plate. POMAGAJ ze wszystkim wokół jedzenia, makro, kalorii, doboru posiłków i logowania jedzenia — w tym 'co zjeść', 'co dojeść na białko', 'czy zmieszczę w cel'. Odmawiaj TYLKO gdy pytanie ewidentnie nie dotyczy jedzenia/odżywiania, jednym zdaniem: 'Pomagam tylko z jedzeniem i makro w Plate.' W razie wątpliwości — pomagaj.

${ACCURACY_GUIDELINES}

LOGOWANIE:
- Gdy user prosi o dodanie jedzenia, ZAWSZE wywołuj addFoodEntry / addMultipleEntries (nie tylko tekst).
- Pole meal w toolach to ZAWSZE polski enum: Śniadanie / Obiad / Kolacja / Przekąska.
- Bez wskazania posiłku wnioskuj z godziny: 5-10 śniadanie, 10-12 lunch, 12-16 obiad, 16-21 kolacja, reszta przekąska.
- kcal i makro to CAŁKOWITE wartości dla porcji (NIE na 100 g).

ODPOWIEDZI:
- Zwięźle (1-2 zdania), konkretne liczby i konkretne produkty, korzystaj z kontekstu dnia.`;

const FEW_SHOT_HISTORY = [
  { role: "user" as const, text: "Co dojeść na białko?" },
  { role: "model" as const, text: "Zostało Ci ~40 g białka — dobrze wejdzie skyr (180 g ≈ 20 g B), pierś z kurczaka (120 g ≈ 28 g B) albo odżywka białkowa (30 g ≈ 22 g B)." },
  { role: "user" as const, text: "Czy zmieszczę się w cel jak zjem batona Snickers?" },
  { role: "model" as const, text: "Snickers 50 g to ~250 kcal — sprawdź swoje 'pozostało kcal'; jeśli masz ≥250 kcal w zapasie, zmieścisz się." },
  { role: "user" as const, text: "Co to jelito grube?" },
  { role: "model" as const, text: "Pomagam tylko z jedzeniem i makro w Plate." },
];

// ============================================================
// Tools (function declarations)
// ============================================================

const FOOD_ENTRY_SCHEMA = {
  type: "object",
  properties: {
    meal: {
      type: "string",
      enum: ["breakfast", "second_breakfast", "lunch", "dinner", "snack"],
      description: "Posiłek: breakfast=śniadanie (5-10), second_breakfast=lunch (10-12), lunch=obiad (12-16), dinner=kolacja (16-21), snack=przekąska (reszta)",
    },
    name: { type: "string", description: "Krótka nazwa produktu po polsku" },
    grams: { type: "number", description: "Waga porcji w gramach (opcjonalnie)" },
    kcal: { type: "number", description: "Całkowite kcal dla porcji" },
    protein: { type: "number", description: "Białko w gramach dla porcji" },
    carbs: { type: "number", description: "Węglowodany w gramach dla porcji" },
    fat: { type: "number", description: "Tłuszcz w gramach dla porcji" },
  },
  required: ["meal", "name", "kcal", "protein", "carbs", "fat"],
};

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "addFoodEntry",
        description: "Dodaje JEDNĄ pozycję do dziennika żywieniowego użytkownika.",
        parameters: FOOD_ENTRY_SCHEMA,
      },
      {
        name: "addMultipleEntries",
        description: "Dodaje WIELE pozycji jednocześnie (np. 'jajka i tost').",
        parameters: {
          type: "object",
          properties: {
            items: { type: "array", items: FOOD_ENTRY_SCHEMA },
          },
          required: ["items"],
        },
      },
    ],
  },
];

// ============================================================
// Helpers
// ============================================================

const MEAL_PL: Record<string, string> = {
  breakfast: "Śniadanie",
  second_breakfast: "Lunch",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
};

function buildDayContextText(ctx: z.infer<typeof DayContextSchema>): string {
  const lines = [
    `Data: ${ctx.date}, godzina: ${ctx.hour}:00`,
    `Cele dnia: ${ctx.goals.kcal} kcal | B ${ctx.goals.protein}g | W ${ctx.goals.carbs}g | T ${ctx.goals.fat}g`,
    `Zjedzone: ${Math.round(ctx.consumed.kcal)} kcal | B ${Math.round(ctx.consumed.protein)}g | W ${Math.round(ctx.consumed.carbs)}g | T ${Math.round(ctx.consumed.fat)}g`,
    `Pozostało: ${Math.round(ctx.remaining.kcal)} kcal | B ${Math.round(ctx.remaining.protein)}g | W ${Math.round(ctx.remaining.carbs)}g | T ${Math.round(ctx.remaining.fat)}g`,
  ];
  if (ctx.entries.length > 0) {
    lines.push("Wpisy dnia:");
    for (const e of ctx.entries) {
      lines.push(
        `- [${MEAL_PL[e.meal]}] ${e.name}: ${Math.round(e.kcal)} kcal, B${Math.round(e.protein)} W${Math.round(e.carbs)} T${Math.round(e.fat)}`,
      );
    }
  } else {
    lines.push("Brak wpisów na ten dzień.");
  }
  return lines.join("\n");
}

function stripFences(text: string): string {
  const t = text.trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return m ? m[1].trim() : t;
}

function getApiKey(): string {
  const k = process.env.Gemini || process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_KEY_MISSING");
  return k;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: unknown };
  inline_data?: { mime_type: string; data: string };
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}

// Centralna lista modeli — priorytet = kolejność. Każdy ma osobną pulę darmową,
// więc fallback realnie sumuje limity. Aby włączyć 3.5 Flash, dodaj na początek.
const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isRetryable = (s: number) => s === 429 || s === 503 || s === 502 || s === 504;

async function callGeminiWithFallback(
  models: string[],
  buildBody: (model: string) => unknown,
  apiKey: string,
): Promise<GeminiResponse> {
  let lastErr: Error | null = null;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(model)),
      });
      if (res.ok) return (await res.json()) as GeminiResponse;
      const txt = await res.text().catch(() => "");
      if (isRetryable(res.status) && i < models.length - 1) {
        await sleep(300 + Math.random() * 300);
        lastErr = new Error(`AI_HTTP_${res.status}: ${txt.slice(0, 200)}`);
        continue;
      }
      if (!isRetryable(res.status)) {
        if (res.status === 402 || res.status === 403) throw new Error("AI_CREDITS");
        throw new Error(`AI_HTTP_${res.status}: ${txt.slice(0, 200)}`);
      }
      if (res.status === 429) lastErr = new Error("AI_RATE_LIMIT");
      else if (res.status === 503) lastErr = new Error("AI_OVERLOADED");
      else lastErr = new Error(`AI_HTTP_${res.status}: ${txt.slice(0, 200)}`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (i < models.length - 1) {
        await sleep(300);
        continue;
      }
    }
  }
  throw lastErr ?? new Error("All Gemini models exhausted");
}

async function callGemini(body: unknown, apiKey: string): Promise<GeminiResponse> {
  return callGeminiWithFallback(MODELS, () => body, apiKey);
}

// ============================================================
// [SEKCJA 8] Placeholder for topic classification gate
// ============================================================
// In the future, prepend a lightweight classifier call here to
// decide in-scope vs out-of-scope BEFORE the main call. For now,
// the system instruction + few-shot enforces scope.
async function classifyTopic(_message: string): Promise<"in_scope" | "out_of_scope" | "unknown"> {
  return "unknown";
}

// ============================================================
// Path A: Multi-image structured items (etykiety / posiłek / mix)
// ============================================================

const ItemsSystemAddendum = `Otrzymujesz jedno lub więcej zdjęć (zwykle etykiety wartości odżywczych) oraz opis tekstowy ilości użytych składników. Dla każdego składnika: odczytaj z etykiety wartości na 100 g (jeśli podane tylko w kJ, przelicz kcal = kJ / 4.184), dopasuj do ilości z tekstu i policz kcal/białko/węgle/tłuszcz dla użytej gramatury (wartość_na_100g × gramy / 100). Gdy user pisze "cały/cała/całe" — użyj wagi netto opakowania z etykiety. Składniki bez czytelnej etykiety lub niewidoczne na zdjęciu (np. oliwa) policz wg standardowych wartości i odnotuj to w notes. Zwróć JEDNĄ pozycję na składnik. Jeśli gramatury nie da się ustalić, ustaw grams = 100 i zaznacz w notes. Ksylitol/poliole licz wg kalorii z etykiety. Nie dubluj składników. Zaokrąglaj kcal do liczby całkowitej, makro do 0,1 g. Zaproponuj dishName i meal na podstawie opisu.

DOKŁADNOŚĆ I OSTROŻNOŚĆ: Rozróżniaj kolumny 'na 100 g' vs 'na porcję' — wybieraj zgodną z opisem usera. Pilnuj jednostek (kJ/kcal, g/mg, sód vs sól = sód×2,5). Przy szacowaniu ze zdjęcia bez etykiety oszacuj gramaturę per składnik (naczynia, sztućce, opakowanie jako skala). Gdy masz przedział możliwych wartości — wybieraj GÓRNĄ granicę realistycznego zakresu; lepiej lekko PRZESZACOWAĆ niż niedoszacować. Sprawdź spójność: kcal ≈ 4×białko + 4×węgle + 9×tłuszcz (tolerancja ~10%) — przy odczycie z etykiety zachowaj wydrukowane kcal, przy szacowaniu popraw, by się zgadzało.`;

const PL_MEAL_TO_INTERNAL: Record<string, Meal> = {
  "Śniadanie": "breakfast",
  "Sniadanie": "breakfast",
  "Obiad": "lunch",
  "Kolacja": "dinner",
  "Przekąska": "snack",
  "Przekaska": "snack",
};

const ItemsResultSchema = z.object({
  dishName: z.string().optional().default(""),
  meal: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        grams: z.number().min(0).max(5000),
        kcal: z.number().min(0).max(10000),
        protein: z.number().min(0).max(1000),
        carbs: z.number().min(0).max(1000),
        fat: z.number().min(0).max(1000),
      }),
    )
    .min(1)
    .max(30),
  notes: z.string().optional(),
});

async function handleImagesPath(
  images: string[],
  apiKey: string,
  userNote: string,
  previews: string[],
  hourFallback: number,
  lang: Lang,
): Promise<AssistantResult> {

  const imageParts: GeminiPart[] = images.map((b64) => {
    const data = b64.startsWith("data:") ? b64.split(",")[1] ?? "" : b64;
    return { inline_data: { mime_type: "image/jpeg", data } };
  });

  const note = userNote.trim();
  const promptText = note
    ? `Opis ilości użytych składników od użytkownika: "${note}".\nZwróć items[] wg schematu — jedna pozycja na składnik.`
    : `Brak opisu od użytkownika. Odczytaj etykiety i przyjmij rozsądną porcję (np. cała porcja z opakowania). Zwróć items[] wg schematu.`;

  const responseSchema = {
    type: "object",
    properties: {
      dishName: { type: "string" },
      meal: { type: "string", enum: ["Śniadanie", "Obiad", "Kolacja", "Przekąska"] },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            grams: { type: "number" },
            kcal: { type: "number" },
            protein: { type: "number" },
            carbs: { type: "number" },
            fat: { type: "number" },
          },
          required: ["name", "grams", "kcal", "protein", "carbs", "fat"],
        },
      },
      notes: { type: "string" },
    },
    required: ["items"],
  };

  const body = {
    system_instruction: { parts: [{ text: `${SYSTEM_INSTRUCTION}\n\n${ItemsSystemAddendum}\n\n${languageAddendum(lang)}` }] },
    contents: [
      {
        role: "user",
        parts: [...imageParts, { text: promptText }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseSchema,
    },
  };

  const tryOnce = async (): Promise<AssistantResult> => {
    const resp = await callGemini(body, apiKey);
    const raw = resp.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!raw) throw new Error("AI_EMPTY");
    const parsed = ItemsResultSchema.parse(JSON.parse(stripFences(raw)));
    const meal: Meal =
      (parsed.meal && PL_MEAL_TO_INTERNAL[parsed.meal]) ||
      mealFromHour(hourFallback);
    return {
      kind: "items",
      dishName: parsed.dishName || "Posiłek",
      meal,
      items: parsed.items.map((it) => ({
        name: it.name,
        grams: Math.round(it.grams * 10) / 10,
        kcal: Math.round(it.kcal),
        protein: Math.round(it.protein * 10) / 10,
        carbs: Math.round(it.carbs * 10) / 10,
        fat: Math.round(it.fat * 10) / 10,
      })),
      notes: parsed.notes,
      previews,
    };
  };

  try {
    return await tryOnce();
  } catch {
    return await tryOnce();
  }
}

function mealFromHour(h: number): Meal {
  if (h >= 5 && h < 10) return "breakfast";
  if (h >= 10 && h < 12) return "second_breakfast";
  if (h >= 12 && h < 16) return "lunch";
  if (h >= 16 && h < 21) return "dinner";
  return "snack";
}


// ============================================================
// Path B: Text (function calling)
// ============================================================

async function handleTextPath(
  message: string,
  history: z.infer<typeof HistorySchema>,
  ctx: z.infer<typeof DayContextSchema>,
  apiKey: string,
  settings: AssistantCallSettings,
  lang: Lang,
): Promise<AssistantResult> {
  const contents: Array<{ role: string; parts: GeminiPart[] }> = [];
  for (const h of FEW_SHOT_HISTORY) {
    contents.push({ role: h.role, parts: [{ text: h.text }] });
  }
  for (const h of history) {
    contents.push({ role: h.role, parts: [{ text: h.text }] });
  }
  const mealHint =
    settings.defaultMeal === "auto"
      ? "Jeśli posiłek nie jest jawnie podany, wnioskuj z pory dnia."
      : `Jeśli posiłek nie jest jawnie podany, użyj domyślnego: ${MEAL_PL[settings.defaultMeal]} (${settings.defaultMeal}).`;
  const lengthHint =
    settings.responseLength === "short"
      ? "Odpowiadaj BARDZO krótko — 1-2 zdania, konkretne liczby."
      : "Odpowiadaj szczegółowo — możesz użyć 3-6 zdań z uzasadnieniem i konkretnymi przykładami.";
  const dynamicSystem = `${SYSTEM_INSTRUCTION}\n\nDODATKOWE REGUŁY SESJI:\n- ${mealHint}\n- ${lengthHint}${
    settings.allowAddEntries ? "" : "\n- NIE WOLNO Ci dodawać wpisów do dziennika — odpowiadaj tylko tekstem, nawet gdy użytkownik prosi o dodanie jedzenia (poinformuj że dodawanie przez AI jest wyłączone w ustawieniach)."
  }\n\n${languageAddendum(lang)}`;
  contents.push({
    role: "user",
    parts: [{ text: `KONTEKST DNIA:\n${buildDayContextText(ctx)}\n\nPYTANIE/POLECENIE: ${message}` }],
  });

  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: dynamicSystem }] },
    contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  };
  if (settings.allowAddEntries) {
    body.tools = TOOLS;
  }

  const tryOnce = async () => {
    const resp = await callGemini(body, apiKey);
    const parts = resp.candidates?.[0]?.content?.parts ?? [];
    const texts: string[] = [];
    const actions: FoodAction[] = [];
    for (const p of parts) {
      if (p.text) texts.push(p.text);
      if (p.functionCall) {
        const fc = p.functionCall;
        const args = fc.args as Record<string, unknown>;
        if (fc.name === "addFoodEntry") {
          const parsed = FoodActionSchema.safeParse(args);
          if (parsed.success) actions.push(parsed.data);
        } else if (fc.name === "addMultipleEntries") {
          const items = (args?.items as unknown[]) ?? [];
          for (const it of items) {
            const parsed = FoodActionSchema.safeParse(it);
            if (parsed.success) actions.push(parsed.data);
          }
        }
      }
    }
    const text = texts.join(" ").trim();
    if (actions.length > 0) {
      const summary =
        text ||
        `Dodano: ${actions
          .map((a) => `${a.name} (${Math.round(a.kcal)} kcal)`)
          .join(", ")}.`;
      return { kind: "actions", actions, text: summary } as AssistantResult;
    }
    if (text) return { kind: "text", text } as AssistantResult;
    throw new Error("AI_EMPTY");
  };

  try {
    return await tryOnce();
  } catch {
    return await tryOnce(); // 1 retry
  }
}

// ============================================================
// Main server fn
// ============================================================

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AskInputSchema.parse(input))
  .handler(async ({ data }): Promise<AssistantResult> => {
    const apiKey = getApiKey();

    // [Sekcja 8] Hook for future topic gate — no-op for now
    await classifyTopic(data.message);

    const images = data.images && data.images.length > 0
      ? data.images
      : data.imageBase64
        ? [data.imageBase64]
        : [];
    const lang: Lang = data.lang ?? "pl";
    if (images.length > 0) {
      return handleImagesPath(images, apiKey, data.message, [], data.dayContext.hour, lang);
    }

    const settings: AssistantCallSettings = {
      autoAddPhoto: data.settings?.autoAddPhoto ?? true,
      allowAddEntries: data.settings?.allowAddEntries ?? true,
      defaultMeal: data.settings?.defaultMeal ?? "auto",
      responseLength: data.settings?.responseLength ?? "short",
    };
    return handleTextPath(data.message, data.history ?? [], data.dayContext, apiKey, settings, lang);
  });

// ============================================================
// Coach review (proactive weekly coaching)
// ============================================================
// Numbers are computed client-side (src/lib/coach.ts); this only turns the
// pre-computed facts into a short, natural coaching note. No raw logs are sent.

const CoachFactsSchema = z.object({
  goalKind: z.enum(["cut", "maintain", "bulk"]),
  planTDEE: z.number(),
  planGoalKcal: z.number(),
  windowDays: z.number(),
  daysLogged: z.number(),
  avgIntake: z.number(),
  avgGoal: z.number(),
  weekBalance: z.number(),
  proteinGoal: z.number(),
  proteinAvg: z.number(),
  proteinHitRate: z.number(),
  weekdayAvg: z.number().nullable(),
  weekendAvg: z.number().nullable(),
  weekendDelta: z.number().nullable(),
  weightLatest: z.number().nullable(),
  weightDeltaKg: z.number().nullable(),
  weightPerWeek: z.number().nullable(),
  realTDEE: z.number().nullable(),
  hasEnoughForReview: z.boolean(),
});

const CoachInputSchema = z.object({
  facts: CoachFactsSchema,
  lang: z.enum(["pl", "en"]).optional(),
});

const GOAL_PL: Record<string, string> = {
  cut: "redukcja",
  maintain: "utrzymanie",
  bulk: "budowa masy",
};

const COACH_SYSTEM = `Jesteś trenerem żywieniowym w aplikacji Plate. Dostajesz POLICZONE statystyki użytkownika z ostatnich dni (nie surowe dane). Twoje zadanie to krótki, proaktywny przegląd jak od dobrego trenera.
ZASADY:
- Zacznij od JEDNEGO zdania oceny: jak poszło względem celu.
- Potem podaj 1-2 KONKRETNE, wykonalne rady dopasowane do celu i liczb. Każda to konkret (co zrobić), nie ogólnik.
- Jeśli podano "realne TDEE" i różni się o ≥150 kcal od celu z kalkulatora, możesz zasugerować korektę celu z konkretną liczbą.
- Używaj WYŁĄCZNIE podanych liczb. Nie zmyślaj danych. Jeśli czegoś nie podano (np. brak wagi/TDEE), nie komentuj braku.
- Ton ciepły, konkretny, szczery. Zero ogólników typu "jedz zdrowo", "pij wodę".
- 3-6 zdań łącznie. Zwykły tekst, bez list i bez markdown.`;

function buildCoachFactsText(f: z.infer<typeof CoachFactsSchema>): string {
  const lines: string[] = [];
  lines.push(`Cel: ${GOAL_PL[f.goalKind] ?? f.goalKind}.`);
  lines.push(`Cel dzienny (apka): ${f.planGoalKcal} kcal. TDEE z kalkulatora: ${f.planTDEE} kcal.`);
  lines.push(`Okno analizy: ${f.windowDays} dni, zalogowanych dni: ${f.daysLogged}.`);
  lines.push(`Średnie spożycie: ${f.avgIntake} kcal/dzień przy średnim celu ${f.avgGoal} kcal.`);
  lines.push(`Bilans bieżącego tygodnia: ${f.weekBalance >= 0 ? "+" : ""}${f.weekBalance} kcal.`);
  lines.push(`Białko: średnio ${f.proteinAvg} g/dzień, cel ${f.proteinGoal} g, trafione w ${Math.round(f.proteinHitRate * 100)}% dni.`);
  if (f.weekendDelta != null)
    lines.push(`Weekendy vs dni robocze: ${f.weekendDelta >= 0 ? "+" : ""}${f.weekendDelta} kcal (weekend ${f.weekendAvg}, dni robocze ${f.weekdayAvg}).`);
  if (f.weightLatest != null) lines.push(`Ostatnia waga: ${f.weightLatest} kg.`);
  if (f.weightPerWeek != null) lines.push(`Trend wagi: ${f.weightPerWeek >= 0 ? "+" : ""}${f.weightPerWeek} kg/tydzień.`);
  if (f.realTDEE != null) lines.push(`Szacowane REALNE TDEE z danych (spożycie + zmiana wagi): ${f.realTDEE} kcal.`);
  return "STATYSTYKI:\n" + lines.join("\n");
}

export const coachReview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CoachInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const apiKey = getApiKey();
    const lang: Lang = data.lang ?? "pl";
    const body = {
      system_instruction: {
        parts: [{ text: `${COACH_SYSTEM}\n\n${languageAddendum(lang)}` }],
      },
      contents: [
        { role: "user", parts: [{ text: buildCoachFactsText(data.facts) }] },
      ],
      generationConfig: { temperature: 0.5, maxOutputTokens: 700 },
    };
    const resp = await callGemini(body, apiKey);
    const parts = resp.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p) => p.text ?? "")
      .join(" ")
      .trim();
    if (!text) throw new Error("AI_EMPTY");
    return { text };
  });
