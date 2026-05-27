
## Plan — Etap 2: skanowanie etykiet odżywczych przez AI

### Dwie uwagi do briefu (zanim wejdziemy w kod)

1. **Bez własnego `AI_API_KEY`.** W Etapie 1 wybrałeś „Lovable AI (Gemini)". Lovable Cloud automatycznie udostępnia `LOVABLE_API_KEY` po stronie serwera i daje dostęp do modeli wizyjnych Gemini przez bramkę AI. Nie trzeba dodawać własnego sekretu ani konta u dostawcy. Jeśli wolisz jednak własny klucz Anthropic/OpenAI, powiedz — wtedy zamiast bramki użyję `AI_API_KEY` z Cloud → Secrets.
2. **Bez Supabase Edge Function.** Ten projekt to TanStack Start — kanonicznym „backendem" jest tu `createServerFn` / route serwerowa w samej aplikacji. Daje to dokładnie ten sam efekt co Edge Function (klucz tylko po stronie serwera, JSON do frontu), ale bez dodatkowego deploymentu. Klucz **nie trafia do bundla frontu** — to zachowane.

Jeśli oba punkty Ci pasują, lecimy z planem poniżej. Jeśli upierasz się przy Edge Function albo własnym kluczu, daj znać i dostosuję.

---

### 1. Włączenie Lovable Cloud
- Włączam Lovable Cloud (Supabase pod spodem, ale dla użytkownika to po prostu „backend Lovable").
- W tej iteracji **nie** dodaję jeszcze tabel ani logowania — store dalej trzyma dane w `localStorage`. Cloud włączamy teraz tylko dlatego, że odblokowuje on bramkę AI i `LOVABLE_API_KEY`. Migrację do bazy zostawiam na osobny etap.

### 2. Server function `scanNutritionLabel` (zamiennik Edge Function)
- Plik: `src/lib/nutrition.functions.ts`.
- Wejście (walidowane Zodem): `{ imageBase64: string (data URL lub czysty base64), mimeType?: string }`.
- Wywołanie modelu wizyjnego przez bramkę Lovable AI: `google/gemini-2.5-flash` (wspiera obrazy, szybki i tani; w razie potrzeby fallback `google/gemini-2.5-pro`).
- System prompt po polsku, wymuszający strukturę:
  ```
  {"name": string, "per100": {"kcal": number, "protein": number, "carbs": number, "fat": number}, "confidence": "high"|"medium"|"low"}
  ```
- Reguły w promptcie (zgodnie z briefem):
  - Wartości **zawsze na 100 g/ml**.
  - Jeśli etykieta podaje tylko „na porcję" + gramaturę porcji → przeliczyć do 100 g.
  - Makro w gramach, energia w kcal, zaokrąglij do 1 miejsca po przecinku.
  - Brak danych → `confidence: "low"` i najlepsze szacunki, nigdy `null`.
- Strukturalne wyjście wymuszone przez `Output.object` z AI SDK + dodatkowa walidacja Zodem po stronie serwera. Funkcja zwraca już tylko ten JSON do frontu.
- Klucz: `process.env.LOVABLE_API_KEY` czytany **wyłącznie** w handlerze server function. Frontend nigdy go nie widzi.

### 3. UI w arkuszu „Dodaj"
W `src/components/AddSheet.tsx` rozszerzam istniejący kafelek **„Skanuj etykietę"** (dziś `soon: true`) — odblokowuję go i podpinam nowy tryb `scan`. Pozostałe „Wkrótce" zostają bez zmian.

Nowy komponent: `src/components/ScanLabelFlow.tsx`. Trzy stany w obrębie arkusza:

1. **Capture** — przycisk uruchamia ukryty `<input type="file" accept="image/*" capture="environment">`. Po wyborze:
   - Zmniejszenie obrazu na canvasie (max ~1600 px na dłuższym boku, JPEG ~0.85) — żeby payload do bramki był rozsądny.
   - Konwersja do base64, przejście do stanu loading.
2. **Loading** — szklany overlay z animowanym shimmer na pierścieniach makro + tekst „Czytam etykietę…". Wywołanie `useServerFn(scanNutritionLabel)` przez TanStack Query (`useMutation`).
3. **Review** — ekran podglądu:
   - Miniatura zdjęcia u góry.
   - **Edytowalna nazwa** (input).
   - **Badge pewności** (high = zielony, medium = bursztyn, low = czerwony) + krótki komunikat „Sprawdź wartości".
   - Sekcja „Na 100 g": cztery edytowalne pola (kcal / B / W / T) wstępnie wypełnione z modelu.
   - **„Ile gramów zjadłem?"** — pole numeryczne (`inputMode="decimal"`), domyślnie 100.
   - **Live preview** poniżej: kcal/B/W/T po przeliczeniu wg wzoru `wartość_na_100 * gramy / 100`, zaokrąglone do 1 miejsca.
   - `MealPicker` (te same 4 posiłki co w pozostałych trybach).
   - Przycisk **„Dodaj do dziennika"** — wywołuje istniejące `addEntry` w storze ze zsumowanymi wartościami i zamyka arkusz.
   - „Zrób ponownie" wraca do stanu Capture.

### 4. Obsługa błędów (widoczna w UI, nie tylko w konsoli)
- `429` z bramki → toast „Za dużo żądań, spróbuj za chwilę".
- `402` (brak kredytów AI) → toast „Brak kredytów AI — doładuj w ustawieniach workspace".
- Inne błędy / model nie zwrócił poprawnego JSON → przejście do Review z pustymi polami i `confidence: "low"`, żeby użytkownik mógł i tak wpisać dane ręcznie.

### 5. Czego świadomie NIE robimy w tej iteracji
- Brak zapisu zdjęć etykiet (nie używamy storage).
- Brak historii skanów ani cache'u — każde zdjęcie to nowe wywołanie.
- Brak migracji store'u do bazy — to osobny etap razem z logowaniem.
- Bez kodów kreskowych, bez wyszukiwarki produktów.

### Szczegóły techniczne (dla mnie, możesz pominąć)

- Pakiety: `ai`, `@ai-sdk/openai-compatible`, `zod` (jeśli któregoś brakuje — instaluję przed napisaniem importu).
- Provider helper: `src/lib/ai-gateway.server.ts` (baseURL `https://ai.gateway.lovable.dev/v1`, nagłówek `Lovable-API-Key`).
- `createServerFn({ method: "POST" }).inputValidator(...).handler(...)` — handler czyta `process.env.LOVABLE_API_KEY` lokalnie, nie na poziomie modułu.
- Bearer attacher nie jest potrzebny — funkcja nie używa `requireSupabaseAuth` (tryb single-user).
- W `AddSheet.tsx` rozszerzam typ `Mode` o `"scan"`, kafelek „Skanuj etykietę" przestaje być `soon`, klik wybiera tryb.
- Zaokrąglanie: helper `round1(x) = Math.round(x * 10) / 10`.

Daj znać czy mam:
(a) zostać przy Lovable AI Gateway + Gemini (rekomendacja, zero konfiguracji po Twojej stronie), czy
(b) jednak użyć Twojego własnego `AI_API_KEY` (powiedz wtedy: OpenAI czy Anthropic).
