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
});

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

const SYSTEM_INSTRUCTION = `Jesteś asystentem żywieniowym aplikacji Plate. Twoim zadaniem jest POMAGAĆ z jedzeniem, makro, kaloriami, wartościami odżywczymi, doborem i rekomendacją posiłków oraz logowaniem jedzenia. Odpowiadaj pomocnie i konkretnie na WSZYSTKO co dotyczy jedzenia, odżywiania, makroskładników, diety i celów użytkownika — w tym pytania typu 'co zjeść', 'co dojeść na białko', 'czy to się zmieści w mój cel', rekomendacje produktów i posiłków. Odpowiadasz po polsku, krótko i konkretnie, korzystając z danych dnia użytkownika. Odmawiasz TYLKO gdy pytanie ewidentnie NIE ma związku z jedzeniem/odżywianiem (np. anatomia, medycyna, polityka, ogólna wiedza) — wtedy jednym zdaniem: 'Pomagam tylko z jedzeniem i makro w Plate.' W razie wątpliwości ZAWSZE pomagaj.

Reguły logowania jedzenia:
- Gdy użytkownik prosi o dodanie jedzenia, ZAWSZE wywołuj funkcję addFoodEntry (lub addMultipleEntries dla wielu pozycji), nie pisz tylko tekstu.
- Jeśli posiłek nie został wskazany, wywnioskuj z pory dnia (5-10 śniadanie, 10-12 lunch, 12-16 obiad, 16-21 kolacja, reszta przekąski).
- Jeśli dokładne makro nie jest znane, podaj najlepsze przybliżenie dla podanej porcji.
- Wartości kcal i makro w funkcjach to CAŁKOWITE wartości dla porcji, NIE na 100 g.

Reguły odpowiedzi na pytania o postęp i rekomendacje:
- Korzystaj z dostarczonego kontekstu dnia (cele, spożycie, pozostało).
- Odpowiadaj zwięźle (1-2 zdania), z konkretnymi liczbami i konkretnymi produktami.`;

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

async function callGemini(body: unknown, apiKey: string): Promise<GeminiResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("AI_RATE_LIMIT");
    if (res.status === 402 || res.status === 403) throw new Error("AI_CREDITS");
    const txt = await res.text().catch(() => "");
    throw new Error(`AI_HTTP_${res.status}: ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as GeminiResponse;
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
// Path A: Image (auto-detect etykieta vs posiłek)
// ============================================================

async function handlePhotoPath(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  userNote?: string,
): Promise<AssistantResult> {
  const base64 = imageBase64.startsWith("data:") ? imageBase64.split(",")[1] ?? "" : imageBase64;
  const notePart = userNote && userNote.trim()
    ? `\n\nDodatkowy opis od użytkownika (użyj go do oszacowania porcji/typu posiłku): "${userNote.trim()}"`
    : "";
  const prompt = `Rozpoznaj czy zdjęcie to ETYKIETA wartości odżywczych, czy zdjęcie GOTOWEGO POSIŁKU. Jeśli etykieta — odczytaj wartości per 100g/100ml do pola per100 (wartości niewidoczne → null). Jeśli posiłek — oszacuj makro całej widocznej porcji do pola total. Nie zgaduj wartości z etykiety, ale posiłek możesz szacować. name = krótka polska nazwa produktu lub dania.${notePart}`;

  const macroSchema = {
    type: "object",
    properties: {
      kcal: { type: "number" },
      protein: { type: "number" },
      carbs: { type: "number" },
      fat: { type: "number" },
    },
    required: ["kcal", "protein", "carbs", "fat"],
    nullable: true,
  };

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      responseSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["etykieta", "posilek"] },
          name: { type: "string" },
          per100: macroSchema,
          total: macroSchema,
          confidence: { type: "number" },
        },
        required: ["type", "name", "confidence"],
      },
    },
  };

  const tryOnce = async (): Promise<AssistantResult> => {
    const resp = await callGemini(body, apiKey);
    const raw = resp.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!raw) throw new Error("AI_EMPTY");
    const parsed = PhotoSchema.parse(JSON.parse(stripFences(raw)));
    if (parsed.type === "etykieta") {
      const per = parsed.per100 ?? { kcal: null, protein: null, carbs: null, fat: null };
      return {
        kind: "label",
        label: {
          name: parsed.name,
          per100: {
            kcal: per?.kcal ?? null,
            protein: per?.protein ?? null,
            carbs: per?.carbs ?? null,
            fat: per?.fat ?? null,
          },
          confidence: parsed.confidence,
        },
      };
    }
    const total = parsed.total ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    return {
      kind: "meal",
      name: parsed.name,
      total: {
        kcal: total.kcal ?? 0,
        protein: total.protein ?? 0,
        carbs: total.carbs ?? 0,
        fat: total.fat ?? 0,
      },
      confidence: parsed.confidence,
    };
  };

  try {
    return await tryOnce();
  } catch {
    return await tryOnce(); // 1 retry
  }
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
  }`;
  contents.push({
    role: "user",
    parts: [{ text: `KONTEKST DNIA:\n${buildDayContextText(ctx)}\n\nPYTANIE/POLECENIE: ${message}` }],
  });

  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: dynamicSystem }] },
    contents,
    generationConfig: { temperature: 0.2 },
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

    if (data.imageBase64) {
      return handlePhotoPath(data.imageBase64, data.mimeType ?? "image/jpeg", apiKey, data.message);
    }
    const settings: AssistantCallSettings = {
      autoAddPhoto: data.settings?.autoAddPhoto ?? true,
      allowAddEntries: data.settings?.allowAddEntries ?? true,
      defaultMeal: data.settings?.defaultMeal ?? "auto",
      responseLength: data.settings?.responseLength ?? "short",
    };
    return handleTextPath(data.message, data.history ?? [], data.dayContext, apiKey, settings);
  });
