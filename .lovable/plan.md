## Plate — Etap 1 (MVP)

Mobilna webapka (max ~430px, wyśrodkowana) do liczenia kalorii i makro. Single-user, dane lokalnie w przeglądarce (IndexedDB/localStorage), bez logowania. Auth i Lovable Cloud dorzucimy w późniejszym etapie razem z funkcjami AI.

### Zakres tej iteracji (z briefu — wyłącznie Etap 1)

1. Nawigacja: pływający pasek-kapsuła ze szkła z 4 zakładkami (Dziś / Statystyki / Profil / Ustawienia) i centralnym przyciskiem „+".
2. Ekran **Dziś**: duży zwijany tytuł, pasek tygodnia, hero z 3 pierścieniami makro + pozostałe kcal w środku, legenda, 4 karty posiłków (Śniadanie/Obiad/Kolacja/Przekąska) z paskiem składu makro i listą pozycji.
3. Arkusz „Dodaj" (ze szkła, sprężysty od dołu) z opcjami:
  - **Szybkie dodawanie** — nazwa (wymagana), kcal (wymagane), opcjonalnie B/W/T, wybór posiłku
  - **Wpisz ręcznie** — nazwa, rozmiar porcji (g), liczba porcji, makro/porcję → przeliczenie i logowanie
  - Pozostałe opcje (Skanuj etykietę, Złożony posiłek, Szukaj, Kod kreskowy) jako wyłączone kafelki z etykietą „Wkrótce"
4. Karty posiłków: + na karcie otwiera arkusz z preselectem; tap pozycji → potwierdzenie usunięcia.
5. Ekran **Ustawienia** (zgrupowane listy w stylu iOS):
  - Wygląd: przełącznik trybu ciemnego (light / dark / system)
  - Cele dzienne: edytowalne kcal, B, W, T (auto-save)
6. Ekran **Statystyki** i **Profil**: szkielet z placeholderami (puste stany + zapowiedź) — pełna treść w kolejnych etapach.
7. PWA podstawy: manifest z własną ikoną „Plate", `display: standalone`, meta tagi apple-mobile-web-app, prosty service worker do cache'owania powłoki.

### Język wizualny

- Akcent UI: grafit (jasny) / biel (ciemny) 
- Makro: białko #FF375F, węgle #FF9F0A, tłuszcz #BF5AF2 (gradient + zaokrąglone końce pierścieni, lekka poświata)
- Liquid glass tylko na pływającej nawigacji i arkuszach (backdrop-blur + saturate, jasny refleks na górnej krawędzi, miękki cień); karty treści solidne
- Tło z subtelnym ambientowym gradientem; osobne tokeny dla light/dark
- Typografia: `-apple-system, system-ui`; duże pogrubione tytuły, bardzo duże liczby z ciasnym trackingiem
- Mikrointerakcje: liczby liczące się w górę, animowane wypełnianie pierścieni, scale przy dotknięciu, sprężyste arkusze (Framer Motion)
- Wszystkie kolory jako semantyczne tokeny w `src/styles.css` (oklch)
- Brak zasobów/nazw Apple; ikony z Lucide; własny wordmark „Plate"

### Logika obliczeń

- Skala porcji: `wartość = wartość_na_100g * gramy / 100`
- Pozostałe kcal: `cel − suma_dnia`
- Pasek składu makro: udziały kalorii `B*4 / W*4 / T*9`, znormalizowane do %
- Sumy dzienne po `date + meal`

### Architektura techniczna

- TanStack Start (istniejący stack), Tailwind v4 + tokeny w `src/styles.css`
- Routy:
  - `/` → Dziś
  - `/stats` → Statystyki (placeholder)
  - `/profile` → Profil (placeholder)
  - `/settings` → Ustawienia
  - Layout z dolną nawigacją wspólny dla wszystkich
- Stan: Zustand (lekki store) + persist do `localStorage`
- Model danych po stronie klienta (bez Supabase w Etapie 1):
  - `profile`: `{ theme, goal_kcal, goal_protein, goal_carbs, goal_fat }`
  - `log_entries[]`: `{ id, date, meal, name, grams?, kcal, protein, carbs, fat, created_at }`
  - Kształt zgodny z docelowym schematem Supabase — łatwa migracja w kolejnym etapie
- Framer Motion do animacji pierścieni/arkuszy/liczb
- `recharts` dorzucimy dopiero w etapie Statystyk

### Czego ŚWIADOMIE nie robimy w tej iteracji

- Brak logowania, brak Lovable Cloud, brak Supabase (zgodnie z odpowiedzią użytkownika)
- Brak Edge Function ani odczytu etykiet (AI) — to Etap 2
- Brak złożonego posiłku, wyszukiwarki, kodu kreskowego, eksportu
- Statystyki i Profil: tylko szkielet, bez wykresów i pełnej zawartości