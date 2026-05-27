import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  imageBase64: z.string().min(100).max(8_000_000),
  mimeType: z.string().optional(),
});

const LabelSchema = z.object({
  name: z.string().min(1).max(120),
  per100: z.object({
    kcal: z.number().min(0).max(2000),
    protein: z.number().min(0).max(200),
    carbs: z.number().min(0).max(200),
    fat: z.number().min(0).max(200),
  }),
  confidence: z.enum(["high", "medium", "low"]),
});

export type NutritionLabel = z.infer<typeof LabelSchema>;

const SYSTEM_PROMPT = `Jesteś ekspertem od odczytywania etykiet odżywczych z produktów spożywczych.
Zwracasz WYŁĄCZNIE poprawny JSON, bez komentarzy, bez markdown, bez \`\`\`.
Format:
{"name": string, "per100": {"kcal": number, "protein": number, "carbs": number, "fat": number}, "confidence": "high"|"medium"|"low"}

Zasady:
- Wszystkie wartości w per100 są ZAWSZE na 100 g (lub 100 ml dla płynów).
- Jeśli etykieta podaje tylko "na porcję" + gramatura porcji, PRZELICZ na 100 g (np. porcja 30 g, 150 kcal → 500 kcal/100 g).
- Makroskładniki w gramach, energia w kcal (jeśli jest tylko kJ, przelicz: kcal = kJ / 4.184).
- Zaokrąglij każdą wartość do 1 miejsca po przecinku.
- "name" to nazwa produktu z etykiety (krótka, do 60 znaków). Jeśli nieczytelna — krótki opis np. "Jogurt naturalny".
- "confidence": "high" gdy widać pełną tabelę odżywczą, "medium" gdy częściowo, "low" gdy musisz mocno szacować lub brakuje danych.
- Nigdy null. Gdy brak danych, podaj rozsądne 0 lub szacunek i ustaw confidence: "low".`;

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

export const scanNutritionLabel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<NutritionLabel> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY nie jest skonfigurowany");
    }

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    // Normalize to data URL
    const mimeType = data.mimeType ?? "image/jpeg";
    const dataUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:${mimeType};base64,${data.imageBase64}`;

    let raw: string;
    try {
      const result = await generateText({
        model,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Odczytaj wartości odżywcze z tej etykiety i zwróć JSON zgodny ze schematem.",
              },
              { type: "image", image: new URL(dataUrl) },
            ],
          },
        ],
      });
      raw = result.text;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Surface status codes if present so the client can show a friendly toast
      if (/429/.test(message)) throw new Error("AI_RATE_LIMIT");
      if (/402/.test(message)) throw new Error("AI_CREDITS");
      throw new Error(`AI_ERROR: ${message}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(raw));
    } catch {
      throw new Error("AI_BAD_JSON");
    }

    const validated = LabelSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error("AI_BAD_SHAPE");
    }

    const v = validated.data;
    return {
      name: v.name.slice(0, 80),
      per100: {
        kcal: round1(v.per100.kcal),
        protein: round1(v.per100.protein),
        carbs: round1(v.per100.carbs),
        fat: round1(v.per100.fat),
      },
      confidence: v.confidence,
    };
  });
