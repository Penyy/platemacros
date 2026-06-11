import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  imageBase64: z.string().min(100).max(8_000_000),
  mimeType: z.string().optional(),
});

const LabelSchema = z.object({
  name: z.string().max(120),
  per100: z.object({
    kcal: z.number().min(0).max(2000),
    protein: z.number().min(0).max(200),
    carbs: z.number().min(0).max(200),
    fat: z.number().min(0).max(200),
  }),
  confidence: z.enum(["high", "medium", "low"]),
});

export type NutritionLabel = z.infer<typeof LabelSchema>;




const ACCURACY_RULES = `WYTYCZNE DOKŁADNOŚCI: Jesteś precyzyjnym ekspertem ds. żywienia.
- Rozróżniaj 'na 100 g/ml' vs 'na porcję'. Pilnuj jednostek (kJ→kcal: kcal=kJ/4,184; g vs mg; sód vs sól=sód×2,5).
- Gdy etykieta podaje wartość, ufaj jej bardziej niż własnemu szacunkowi.
- Bez etykiety: rozpoznaj każdy składnik i oszacuj jego gramaturę (naczynia, sztućce, opakowanie jako skala), policz per składnik i zsumuj.
- ZASADA OSTROŻNOŚCI: gdy masz przedział możliwych wartości, wybieraj GÓRNĄ granicę realistycznego zakresu. Lepiej lekko PRZESZACOWAĆ kalorie i makro niż niedoszacować — w razie wątpliwości zaokrąglaj w górę, ale rozsądnie.
- SPÓJNOŚĆ: kcal ≈ 4×białko + 4×węglowodany + 9×tłuszcz (tolerancja ~10%). Przy szacowaniu popraw wartości tak, by się zgadzały. Przy odczycie z etykiety zachowaj wydrukowane kcal.
- Zawsze zwróć najlepsze możliwe oszacowanie — nie odmawiaj z powodu niepewności.`;

const PROMPT = `Odczytaj tabelę wartości odżywczych z tej etykiety produktu spożywczego.
Zwróć WYŁĄCZNIE poprawny JSON (bez markdown, bez komentarzy) o strukturze:
{"name": string, "per100": {"kcal": number, "protein": number, "carbs": number, "fat": number}, "confidence": "high"|"medium"|"low"}

${ACCURACY_RULES}

Zasady:
- Wartości w per100 ZAWSZE na 100 g (lub 100 ml dla płynów).
- Jeśli etykieta podaje tylko "na porcję" + gramatura porcji, przelicz na 100 g (np. porcja 30 g, 150 kcal → 500 kcal/100 g).
- Makro w gramach, energia w kcal (jeśli tylko kJ: kcal = kJ / 4.184).
- Zaokrąglij każdą wartość do 1 miejsca po przecinku.
- name = krótka nazwa produktu jeśli widoczna na etykiecie (do 60 znaków), inaczej pusty string "".
- confidence: "high" gdy pełna tabela czytelna, "medium" przy częściowych danych, "low" gdy szacujesz.
- Nigdy null. Brak danych → 0 i confidence "low".`;

function stripFences(text: string): string {
  const t = text.trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return m ? m[1].trim() : t;
}

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

// Centralna lista modeli — priorytet = kolejność. Każdy ma osobną pulę darmową.
const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
// Skan etykiety — lżejszy model na froncie wystarczy do OCR tabeli wartości.
const MODELS_LABEL = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isRetryable = (s: number) => s === 429 || s === 503 || s === 502 || s === 504;

async function callGeminiWithFallback(models: string[], apiKey: string, body: GeminiBody): Promise<string> {
  let lastErr: Error | null = null;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const payload = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const raw = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        if (!raw) throw new Error("AI_EMPTY");
        return raw;
      }
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

export const scanNutritionLabel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<NutritionLabel> => {
    const apiKey = process.env.Gemini || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_KEY_MISSING");
    }

    const mimeType = data.mimeType ?? "image/jpeg";
    const base64 = data.imageBase64.startsWith("data:")
      ? data.imageBase64.split(",")[1] ?? ""
      : data.imageBase64;

    const body = {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    };

    const raw = await callGeminiWithFallback(apiKey, body);
    if (!raw) throw new Error("AI_EMPTY");

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(raw));
    } catch {
      throw new Error("AI_BAD_JSON");
    }

    const v = LabelSchema.safeParse(parsed);
    if (!v.success) throw new Error("AI_BAD_SHAPE");

    return {
      name: v.data.name.slice(0, 80),
      per100: {
        kcal: round1(v.data.per100.kcal),
        protein: round1(v.data.per100.protein),
        carbs: round1(v.data.per100.carbs),
        fat: round1(v.data.per100.fat),
      },
      confidence: v.data.confidence,
    };
  });

// ---------- Estimate full meal from photo ----------

const EstimateInputSchema = z.object({
  imageBase64: z.string().min(100).max(8_000_000),
  mimeType: z.string().optional(),
  description: z.string().max(500).optional(),
});

const EstimateSchema = z.object({
  name: z.string().max(120),
  total: z.object({
    kcal: z.number().min(0).max(5000),
    protein: z.number().min(0).max(500),
    carbs: z.number().min(0).max(500),
    fat: z.number().min(0).max(500),
  }),
  confidence: z.enum(["high", "medium", "low"]),
});

export type MealEstimate = z.infer<typeof EstimateSchema>;

const ESTIMATE_PROMPT = `Oszacuj wartości odżywcze gotowego posiłku widocznego na zdjęciu.
Zwróć WYŁĄCZNIE poprawny JSON (bez markdown) o strukturze:
{"name": string, "total": {"kcal": number, "protein": number, "carbs": number, "fat": number}, "confidence": "high"|"medium"|"low"}

${ACCURACY_RULES}

Zasady:
- Wartości w "total" to CAŁKOWITE wartości dla widocznej porcji (NIE na 100 g).
- Rozpoznaj składniki i oszacuj wielkość porcji (talerz ~26 cm, miska, sztućce jako skala). Policz per składnik i zsumuj.
- Wykorzystaj opis użytkownika do rozpoznania składników i wielkości, jeśli jest podany.
- Makro w gramach, energia w kcal. Zaokrąglij do 1 miejsca po przecinku.
- name = krótka polska nazwa dania (do 60 znaków).
- confidence: "high" gdy wyraźnie widać składniki i porcję, "medium" przy częściowej widoczności, "low" gdy mocno szacujesz.
- To jest SZACUNEK — przy wątpliwościach stosuj zasadę ostrożności (lekko w górę) i obniż confidence, ale zawsze podaj liczby > 0 jeśli widać jedzenie.`;

export const estimateMealFromPhoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EstimateInputSchema.parse(input))
  .handler(async ({ data }): Promise<MealEstimate> => {
    const apiKey = process.env.Gemini || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_KEY_MISSING");

    const mimeType = data.mimeType ?? "image/jpeg";
    const base64 = data.imageBase64.startsWith("data:")
      ? data.imageBase64.split(",")[1] ?? ""
      : data.imageBase64;

    const userText = data.description?.trim()
      ? `${ESTIMATE_PROMPT}\n\nOpis od użytkownika: ${data.description.trim()}`
      : ESTIMATE_PROMPT;

    const body = {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: userText },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    };

    const raw = await callGeminiWithFallback(apiKey, body);
    if (!raw) throw new Error("AI_EMPTY");

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(raw));
    } catch {
      throw new Error("AI_BAD_JSON");
    }

    const v = EstimateSchema.safeParse(parsed);
    if (!v.success) throw new Error("AI_BAD_SHAPE");

    return {
      name: v.data.name.slice(0, 80),
      total: {
        kcal: round1(v.data.total.kcal),
        protein: round1(v.data.total.protein),
        carbs: round1(v.data.total.carbs),
        fat: round1(v.data.total.fat),
      },
      confidence: v.data.confidence,
    };
  });
