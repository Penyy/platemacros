import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { Download, Upload, LogOut, CloudUpload, MessageSquare } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Switch } from "@/components/ui/switch";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import {
  type Theme,
  type LogEntry,
  type Meal,
  type DayMacro,
  type AssistantDefaultMeal,
  type AssistantResponseLength,
  defaultAssistantSettings,
  usePlate,
  readLegacyLocalStorage,
  clearLegacyLocalStorage,
  seedWeeklyFromProfile,
  MEAL_LABEL,
} from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function mealFromHour(h: number): Meal {
  if (h >= 5 && h < 10) return "breakfast";
  if (h >= 10 && h < 12) return "second_breakfast";
  if (h >= 12 && h < 16) return "lunch";
  if (h >= 16 && h < 21) return "dinner";
  return "snack";
}

function convertMacroFlow(items: any[]): LogEntry[] {
  const out: LogEntry[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const eatenAt = item.eatenAt ? new Date(item.eatenAt) : null;
    if (!eatenAt || isNaN(eatenAt.getTime())) continue;
    const date = eatenAt.toISOString().slice(0, 10);
    const meal = mealFromHour(eatenAt.getHours());
    const servingG = Number(item?.selectedServing?.grams ?? 1) || 1;
    const qty = Number(item?.quantity ?? 1) || 1;
    out.push({
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      date,
      meal,
      name: String(item.name ?? "Bez nazwy"),
      grams: Math.round(qty * servingG),
      kcal: Math.round(Number(item.calories ?? 0)),
      protein: Number(item.protein ?? 0),
      carbs: Number(item.carbs ?? 0),
      fat: Number(item.fat ?? 0),
      created_at: eatenAt.getTime(),
    });
  }
  return out;
}

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Plate — Ustawienia" },
      {
        name: "description",
        content: "Ustaw cele dzienne i wygląd aplikacji.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const profile = usePlate((s) => s.profile);
  const entries = usePlate((s) => s.entries);
  const burned = usePlate((s) => s.burned);
  const products = usePlate((s) => s.products);
  const setTheme = usePlate((s) => s.setTheme);
  const setGoals = usePlate((s) => s.setGoals);
  const setIncludeBurned = usePlate((s) => s.setIncludeBurned);
  const setWeeklyEnabled = usePlate((s) => s.setWeeklyEnabled);
  const setWeeklyDay = usePlate((s) => s.setWeeklyDay);
  const setAssistant = usePlate((s) => s.setAssistant);
  const replaceAll = usePlate((s) => s.replaceAll);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [legacy, setLegacy] = useState<ReturnType<typeof readLegacyLocalStorage>>(null);
  const [migrating, setMigrating] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    setLegacy(readLegacyLocalStorage());
  }, []);

  async function handleMigrate() {
    if (!legacy || migrating) return;
    const ok = confirm(
      `Przenieść ${legacy.entries.length} wpisów i ${legacy.products.length} produktów do chmury? Obecne dane w chmurze zostaną nadpisane.`
    );
    if (!ok) return;
    setMigrating(true);
    try {
      await replaceAll(legacy);
      clearLegacyLocalStorage();
      setLegacy(null);
      toast.success("Dane zostały przeniesione do chmury.");
    } catch {
      toast.error("Nie udało się przenieść danych.");
    } finally {
      setMigrating(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
  }

  function handleExport() {
    const payload = {
      app: "plate",
      version: 1,
      exported_at: new Date().toISOString(),
      profile,
      entries,
      burned,
      products,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `plate-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== "object") {
        alert("Nieprawidłowy plik.");
        return;
      }

      // MacroFlow export detection
      if (Array.isArray((data as any).myFoods)) {
        const converted = convertMacroFlow((data as any).myFoods);
        if (converted.length === 0) {
          alert("Nie znaleziono wpisów w pliku MacroFlow.");
          return;
        }
        const ok = confirm(
          `Znaleziono ${converted.length} wpisów z MacroFlow — importować?`
        );
        if (!ok) return;
        await replaceAll({
          profile,
          entries: [...entries, ...converted],
          burned,
          products,
        });
        alert(`Zaimportowano ${converted.length} wpisów z MacroFlow.`);
        return;
      }

      // Plate native format
      if (!data.profile || !Array.isArray(data.entries)) {
        alert("Nieprawidłowy plik kopii zapasowej.");
        return;
      }
      const ok = confirm(
        `Importować ${data.entries.length} wpisów? Obecne dane zostaną nadpisane.`
      );
      if (!ok) return;
      await replaceAll({
        profile: data.profile,
        entries: data.entries,
        burned: data.burned && typeof data.burned === "object" ? data.burned : {},
        products: Array.isArray(data.products) ? data.products : [],
      });
      alert("Dane zostały przywrócone.");
    } catch {
      alert("Nie udało się odczytać pliku.");
    }
  }

  return (
    <div>
      <ScreenHeader title="Ustawienia" />

      <Section title="Wygląd">
        <Row label="Motyw">
          <ThemeSelect value={profile.theme} onChange={(t) => setTheme(t)} />
        </Row>
      </Section>

      <Section title="Cele dzienne">
        <NumberRow
          label="Kalorie"
          unit="kcal"
          value={profile.goal_kcal}
          onChange={(v) => setGoals({ goal_kcal: v })}
        />
        <NumberRow
          label="Białko"
          unit="g"
          value={profile.goal_protein}
          onChange={(v) => setGoals({ goal_protein: v })}
        />
        <NumberRow
          label="Węglowodany"
          unit="g"
          value={profile.goal_carbs}
          onChange={(v) => setGoals({ goal_carbs: v })}
        />
        <NumberRow
          label="Tłuszcz"
          unit="g"
          value={profile.goal_fat}
          onChange={(v) => setGoals({ goal_fat: v })}
        />
      </Section>

      <Section title="Cele tygodniowe">
        <Row label="Inne cele na każdy dzień tygodnia">
          <Switch
            checked={!!profile.weekly_targets_enabled}
            onCheckedChange={(v) => setWeeklyEnabled(v)}
          />
        </Row>
        <p className="px-4 pb-2 pt-1 text-[11px] text-muted-foreground">
          Dla cyklizacji węglowodanów — kcal liczone z B×4 + W×4 + T×9.
        </p>
        {profile.weekly_targets_enabled && (
          <WeeklyEditor
            value={profile.weekly_macro_targets ?? seedWeeklyFromProfile(profile)}
            onChange={(idx, m) => setWeeklyDay(idx, m)}
          />
        )}
      </Section>

      <Section title="Aktywność">
        <Row label="Uwzględniaj spalone kcal">
          <Switch
            checked={!!profile.include_burned}
            onCheckedChange={(v) => setIncludeBurned(v)}
          />
        </Row>
        <p className="px-4 pb-3 pt-1 text-[11px] text-muted-foreground">
          Gdy włączone, spalone kalorie powiększają dzienny cel (cel + spalone − zjedzone).
        </p>
      </Section>

      <Section title="Asystent AI">
        <Row label="Auto-dodaj ze zdjęcia z opisem">
          <Switch
            checked={(profile.assistant ?? defaultAssistantSettings).autoAddPhoto}
            onCheckedChange={(v) => setAssistant({ autoAddPhoto: v })}
          />
        </Row>
        <p className="px-4 pb-2 pt-1 text-[11px] text-muted-foreground">
          Gdy włączone, zdjęcie posiłku z opisem dodaje się bez dodatkowego potwierdzenia.
        </p>
        <Row label="Asystent może dodawać wpisy">
          <Switch
            checked={(profile.assistant ?? defaultAssistantSettings).allowAddEntries}
            onCheckedChange={(v) => setAssistant({ allowAddEntries: v })}
          />
        </Row>
        <p className="px-4 pb-2 pt-1 text-[11px] text-muted-foreground">
          Gdy wyłączone, AI tylko odpowiada — nie zapisuje nic do dziennika.
        </p>
        <Row label="Domyślny posiłek">
          <DefaultMealSelect
            value={(profile.assistant ?? defaultAssistantSettings).defaultMeal}
            onChange={(v) => setAssistant({ defaultMeal: v })}
          />
        </Row>
        <Row label="Długość odpowiedzi">
          <ResponseLengthSelect
            value={(profile.assistant ?? defaultAssistantSettings).responseLength}
            onChange={(v) => setAssistant({ responseLength: v })}
          />
        </Row>
      </Section>




      <Section title="Dane">
        <button
          onClick={handleExport}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-foreground/5 transition"
        >
          <Download size={18} className="text-muted-foreground" />
          <div className="flex-1">
            <div className="text-[15px]">Eksportuj dane</div>
            <div className="text-[11px] text-muted-foreground">
              Pobierz plik JSON z całą historią
            </div>
          </div>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-foreground/5 transition"
        >
          <Upload size={18} className="text-muted-foreground" />
          <div className="flex-1">
            <div className="text-[15px]">Importuj dane</div>
            <div className="text-[11px] text-muted-foreground">
              Wczytaj kopię zapasową (nadpisze obecne)
            </div>
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = "";
          }}
        />
      </Section>

      {legacy && (
        <Section title="Migracja">
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-foreground/5 transition disabled:opacity-60"
          >
            <CloudUpload size={18} className="text-muted-foreground" />
            <div className="flex-1">
              <div className="text-[15px]">
                {migrating ? "Przenoszę…" : "Przenieś moje dane do chmury"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Znaleziono {legacy.entries.length} wpisów i {legacy.products.length} produktów lokalnie.
              </div>
            </div>
          </button>
        </Section>
      )}

      <Section title="Konto">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-foreground/5 transition"
        >
          <LogOut size={18} className="text-muted-foreground" />
          <div className="flex-1">
            <div className="text-[15px]">Wyloguj się</div>
          </div>
        </button>
      </Section>

      <Section title="Opinie">
        <button
          onClick={() => setFeedbackOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-foreground/5 transition"
        >
          <MessageSquare size={18} className="text-muted-foreground" />
          <div className="flex-1">
            <div className="text-[15px]">Prześlij opinię</div>
            <div className="text-[11px] text-muted-foreground">
              Powiedz nam co poprawić lub co Ci się podoba
            </div>
          </div>
        </button>
      </Section>

      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      <p className="px-6 pt-2 pb-6 text-center text-[11px] text-muted-foreground">
        Plate · wersja 0.1
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h2
        className="px-[26px] pb-2 text-[11px] font-semibold"
        style={{ color: "var(--muted-foreground)" }}
      >
        {title}
      </h2>
      <div
        className="mx-[18px] divide-y overflow-hidden rounded-[24px] bg-card"
        style={{ boxShadow: "var(--shadow-card)", borderColor: "var(--hairline)" }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-[15px]" style={{ color: "var(--ink)", fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  );
}

function NumberRow({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-1">
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^\d]/g, ""));
            if (!Number.isNaN(n)) onChange(n);
          }}
          className="num-tight w-20 rounded-xl px-2.5 py-1.5 text-right text-[15px] outline-none"
          style={{ background: "var(--hairline)", color: "var(--ink)", fontWeight: 700 }}
        />
        <span className="w-7 text-left text-xs" style={{ color: "var(--muted-foreground)" }}>{unit}</span>
      </div>
    </Row>
  );
}

function ThemeSelect({
  value,
  onChange,
}: {
  value: Theme;
  onChange: (t: Theme) => void;
}) {
  const opts: { v: Theme; l: string }[] = [
    { v: "light", l: "Jasny" },
    { v: "dark", l: "Ciemny" },
    { v: "system", l: "System" },
  ];
  return (
    <div className="flex gap-0.5 rounded-full p-0.5" style={{ background: "var(--hairline)" }}>
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className="rounded-full px-3 py-1 text-xs transition"
            style={{
              background: active ? "#1B1B19" : "transparent",
              color: active ? "#FBF4E2" : "var(--muted-foreground)",
              fontWeight: active ? 700 : 600,
            }}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

const DAY_LABELS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"];

function WeeklyEditor({
  value,
  onChange,
}: {
  value: Record<string, DayMacro>;
  onChange: (dayIdx: number, m: Partial<DayMacro>) => void;
}) {
  return (
    <div className="px-3 pb-3">
      <div className="grid grid-cols-[36px_1fr_1fr_1fr_auto] items-center gap-1 px-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span></span>
        <span className="text-center">B</span>
        <span className="text-center">W</span>
        <span className="text-center">T</span>
        <span className="pl-2 text-right">kcal</span>
      </div>
      <div className="space-y-1">
        {DAY_LABELS.map((label, i) => {
          const d = value[String(i)] ?? { protein: 0, carbs: 0, fat: 0 };
          const kcal = Math.round(d.protein * 4 + d.carbs * 4 + d.fat * 9);
          return (
            <div
              key={i}
              className="grid grid-cols-[36px_1fr_1fr_1fr_auto] items-center gap-1 rounded-xl bg-foreground/5 px-2 py-1.5"
            >
              <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
              <MacroInput value={d.protein} onChange={(v) => onChange(i, { protein: v })} />
              <MacroInput value={d.carbs} onChange={(v) => onChange(i, { carbs: v })} />
              <MacroInput value={d.fat} onChange={(v) => onChange(i, { fat: v })} />
              <span className="num-tight pl-2 text-right text-[12px] font-semibold">
                {kcal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MacroInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      inputMode="numeric"
      value={value || ""}
      onChange={(e) => {
        const n = Number(e.target.value.replace(/[^\d]/g, ""));
        onChange(Number.isNaN(n) ? 0 : n);
      }}
      className="num-tight w-full rounded-md bg-background px-1.5 py-1 text-center text-[13px] font-semibold outline-none focus:ring-1 focus:ring-primary"
    />
  );
}

function DefaultMealSelect({
  value,
  onChange,
}: {
  value: AssistantDefaultMeal;
  onChange: (v: AssistantDefaultMeal) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AssistantDefaultMeal)}
      className="rounded-lg border border-border/60 bg-card px-2 py-1 text-[13px]"
    >
      <option value="auto">Wnioskuj z pory</option>
      {(Object.keys(MEAL_LABEL) as Meal[]).map((m) => (
        <option key={m} value={m}>
          {MEAL_LABEL[m]}
        </option>
      ))}
    </select>
  );
}

function ResponseLengthSelect({
  value,
  onChange,
}: {
  value: AssistantResponseLength;
  onChange: (v: AssistantResponseLength) => void;
}) {
  const opts: { v: AssistantResponseLength; l: string }[] = [
    { v: "short", l: "Krótkie" },
    { v: "detailed", l: "Szczegółowe" },
  ];
  return (
    <div className="flex gap-0.5 rounded-full bg-foreground/5 p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            value === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
