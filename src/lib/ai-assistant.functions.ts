import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ============================================================
// Types
// ============================================================

const MealEnum = z.enum(["breakfast", "lunch", "dinner", "snack"]);

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

const AskInputSchema = z.object({
  message: z.string().max(1000),
  history: HistorySchema.optional().default([]),
  dayContext: DayContextSchema,
  imageBase64: z.string().min(100).max(8_000_000).optional(),
  mimeType: z.string().optional(),
});

// Output kinds
const LabelSchema = z.object({
  name: z.string(),
  per100: z.object({
    kcal: z.number().nullable(),
    protein: z.number().nullable(),
    carbs: z.number().nullable(),
    fat: z.number().nullable(),
  }),
  confidence: z.number().min(0).max(1),
});
export type ScannedLabel = z.infer<typeof LabelSchema>;

export type AssistantResult =
  | { kind: "text"; text: string }
  | { kind: "actions"; actions: FoodAction[]; text: string }
  | { kind: "label"; label: ScannedLabel };

// ============================================================
// Prompts
// ============================================================

const SYSTEM_INSTRUCTION = `Jesteś asystentem aplikacji Plate do śledzenia makroskładników. Pomagasz WYŁĄCZNIE z: (a) pytaniami o makro, kalorie i wartości odżywcze produktów/posiłków, (b) postępem użytkownika względem celów dnia, (c) logowaniem jedzenia do dziennika. Odpowiadasz zawsze po polsku, krótko i konkretnie. Każdy temat spoza tego zakresu — w tym zdrowie, medycyna, anatomia, ćwiczenia, ogólna wiedza — odrzucasz dokładnie jednym zdaniem: 'Pomagam tylko z makro i jedzeniem w Plate.' Nie tłumaczysz, nie rozwijasz, nie dajesz porad medycznych.

Reguły logowania jedzenia:
- Gdy użytkownik prosi o dodanie jedzenia, ZAWSZE wywołuj funkcję addFoodEntry (lub addMultipleEntries dla wielu pozycji), nie pisz tylko tekstu.
- Jeśli posiłek nie został wskazany, wywnioskuj z pory dnia (5-10 śniadanie, 11-14 obiad, 15-20 kolacja, reszta przekąski).
- Jeśli dokładne makro nie jest znane, podaj najlepsze przybliżenie dla podanej porcji.
- Wartości kcal i makro w funkcjach to CAŁKOWITE wartości dla porcji, NIE na 100 g.
- Po wywołaniu funkcji dodaj krótki komentarz potwierdzający (np. "Dodano: 2 jajka — 156 kcal").

Reguły odpowiedzi na pytania o postęp:
- Korzystaj z dostarczonego kontekstu dnia (cele, spożycie, pozostało).
- Odpowiadaj zwięźle (1-2 zdania), z konkretnymi liczbami.`;

const FEW_SHOT_HISTORY = [
  { role: "user" as const, text: "Co to jelito grube?" },
  { role: "model" as const, text: "Pomagam tylko z makro i jedzeniem w Plate." },
];

// ============================================================
// Tools (function declarations)
// ============================================================

const FOOD_ENTRY_SCHEMA = {
  type: "object",
  properties: {
    meal: {
      type: "string",
      enum: ["breakfast", "lunch", "dinner", "snack"],
      description: "Posiłek: breakfast=śniadanie, lunch=obiad, dinner=kolacja, snack=przekąska",
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
// Path A: Image (nutrition label)
// ============================================================

async function handleLabelPath(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
): Promise<AssistantResult> {
  const base64 = imageBase64.startsWith("data:") ? imageBase64.split(",")[1] ?? "" : imageBase64;
  const prompt = `Odczytaj wartości odżywcze Z ETYKIETY na zdjęciu, w przeliczeniu na 100 g/100 ml. Nie zgaduj, nie wymyślaj. Wartości niewidoczne na etykiecie → null.`;

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
      temperature: 0.1,
      responseSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          per100: {
            type: "object",
            properties: {
              kcal: { type: "number", nullable: true },
              protein: { type: "number", nullable: true },
              carbs: { type: "number", nullable: true },
              fat: { type: "number", nullable: true },
            },
            required: ["kcal", "protein", "carbs", "fat"],
          },
          confidence: { type: "number" },
        },
        required: ["name", "per100", "confidence"],
      },
    },
  };

  const tryOnce = async () => {
    const resp = await callGemini(body, apiKey);
    const raw = resp.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!raw) throw new Error("AI_EMPTY");
    const parsed = JSON.parse(stripFences(raw));
    return LabelSchema.parse(parsed);
  };

  let label: ScannedLabel;
  try {
    label = await tryOnce();
  } catch {
    label = await tryOnce(); // 1 retry
  }
  return { kind: "label", label };
}

// ============================================================
// Path B: Text (function calling)
// ============================================================

async function handleTextPath(
  message: string,
  history: z.infer<typeof HistorySchema>,
  ctx: z.infer<typeof DayContextSchema>,
  apiKey: string,
): Promise<AssistantResult> {
  const contents: Array<{ role: string; parts: GeminiPart[] }> = [];
  for (const h of FEW_SHOT_HISTORY) {
    contents.push({ role: h.role, parts: [{ text: h.text }] });
  }
  for (const h of history) {
    contents.push({ role: h.role, parts: [{ text: h.text }] });
  }
  contents.push({
    role: "user",
    parts: [{ text: `KONTEKST DNIA:\n${buildDayContextText(ctx)}\n\nPYTANIE/POLECENIE: ${message}` }],
  });

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents,
    tools: TOOLS,
    generationConfig: { temperature: 0.2 },
  };

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
      return handleLabelPath(data.imageBase64, data.mimeType ?? "image/jpeg", apiKey);
    }
    return handleTextPath(data.message, data.history ?? [], data.dayContext, apiKey);
  });
