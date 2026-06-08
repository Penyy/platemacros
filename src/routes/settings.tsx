import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Download, Upload, LogOut, CloudUpload, MessageSquare, Layers, Zap, PencilLine, Search as SearchIcon, ScanLine, Sparkles, Trash2 } from "lucide-react";
import { setAppLanguage, getAppLanguage, type AppLang } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  type PlusMenuItemId,
  defaultAssistantSettings,
  defaultPlusMenuVisibility,
  PLUS_MENU_ITEMS,
  
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
  const { t } = useTranslation();
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
  const setPlusMenuItem = usePlate((s) => s.setPlusMenuItem);
  const plusVisibility = usePlate(
    (s) => s.profile.plus_menu_visibility ?? defaultPlusMenuVisibility,
  );
  const replaceAll = usePlate((s) => s.replaceAll);
  const bootstrap = usePlate((s) => s.bootstrap);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [legacy, setLegacy] = useState<ReturnType<typeof readLegacyLocalStorage>>(null);
  const [migrating, setMigrating] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(5);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!resetOpen) {
      setResetCountdown(5);
      return;
    }
    setResetCountdown(5);
    const t = setInterval(() => {
      setResetCountdown((n) => (n > 0 ? n - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [resetOpen]);

  const handleResetData = async () => {
    if (resetCountdown > 0 || resetting) return;
    setResetting(true);
    try {
      const { error } = await supabase.rpc("reset_user_data");
      if (error) throw error;
      await bootstrap();
      setResetOpen(false);
      toast.success(t("settings.danger.resetSuccess"));
      navigate({ to: "/" });
    } catch (err) {
      console.error("reset_user_data failed", err);
      toast.error(t("settings.danger.resetError"));
    } finally {
      setResetting(false);
    }
  };

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
      toast.success(t("settings.toast.migrateOk"));
    } catch {
      toast.error(t("settings.toast.migrateErr"));
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
      <ScreenHeader title={t("settings.title")} />

      <Section title={t("settings.sec.appearance")}>
        <Row label={t("settings.theme.label")}>
          <ThemeSelect value={profile.theme} onChange={(th) => setTheme(th)} />
        </Row>
      </Section>

      <Section title={t("settings.sec.language")}>
        <Row label={t("settings.language.label")}>
          <LanguageSelect />
        </Row>
      </Section>

      <Section title={t("settings.sec.goals")}>
        <NumberRow
          label={t("settings.goals.kcal")}
          unit={t("settings.goals.unitKcal")}
          value={profile.goal_kcal}
          onChange={(v) => setGoals({ goal_kcal: v })}
        />
        <NumberRow
          label={t("settings.goals.protein")}
          unit={t("settings.goals.unitG")}
          value={profile.goal_protein}
          onChange={(v) => setGoals({ goal_protein: v })}
        />
        <NumberRow
          label={t("settings.goals.carbs")}
          unit={t("settings.goals.unitG")}
          value={profile.goal_carbs}
          onChange={(v) => setGoals({ goal_carbs: v })}
        />
        <NumberRow
          label={t("settings.goals.fat")}
          unit={t("settings.goals.unitG")}
          value={profile.goal_fat}
          onChange={(v) => setGoals({ goal_fat: v })}
        />
      </Section>

      <Section title={t("settings.sec.weekly")}>
        <Row label={t("settings.weekly.switch")}>
          <Switch
            checked={!!profile.weekly_targets_enabled}
            onCheckedChange={(v) => setWeeklyEnabled(v)}
          />
        </Row>
        <p className="px-4 pb-2 pt-1 text-[11px] text-muted-foreground">
          {t("settings.weekly.note")}
        </p>
        {profile.weekly_targets_enabled && (
          <WeeklyEditor
            value={profile.weekly_macro_targets ?? seedWeeklyFromProfile(profile)}
            onChange={(idx, m) => setWeeklyDay(idx, m)}
          />
        )}
      </Section>

      <Section title={t("settings.sec.activity")}>
        <Row label={t("settings.activity.includeBurned")}>
          <Switch
            checked={!!profile.include_burned}
            onCheckedChange={(v) => setIncludeBurned(v)}
          />
        </Row>
        <p className="px-4 pb-3 pt-1 text-[11px] text-muted-foreground">
          {t("settings.activity.note")}
        </p>
      </Section>

      <Section title={t("settings.sec.assistant")}>
        <Row label={t("settings.assistant.autoAddPhoto")}>
          <Switch
            checked={(profile.assistant ?? defaultAssistantSettings).autoAddPhoto}
            onCheckedChange={(v) => setAssistant({ autoAddPhoto: v })}
          />
        </Row>
        <p className="px-4 pb-2 pt-1 text-[11px] text-muted-foreground">
          {t("settings.assistant.autoAddPhotoNote")}
        </p>
        <Row label={t("settings.assistant.allowAddEntries")}>
          <Switch
            checked={(profile.assistant ?? defaultAssistantSettings).allowAddEntries}
            onCheckedChange={(v) => setAssistant({ allowAddEntries: v })}
          />
        </Row>
        <p className="px-4 pb-2 pt-1 text-[11px] text-muted-foreground">
          {t("settings.assistant.allowAddEntriesNote")}
        </p>
        <Row label={t("settings.assistant.defaultMeal")}>
          <DefaultMealSelect
            value={(profile.assistant ?? defaultAssistantSettings).defaultMeal}
            onChange={(v) => setAssistant({ defaultMeal: v })}
          />
        </Row>
        <Row label={t("settings.assistant.responseLength")}>
          <ResponseLengthSelect
            value={(profile.assistant ?? defaultAssistantSettings).responseLength}
            onChange={(v) => setAssistant({ responseLength: v })}
          />
        </Row>
      </Section>

      <Section
        title={t("settings.sec.plusMenu")}
        subtitle={t("settings.sec.plusMenuSubtitle")}
      >
        <PlusMenuVisibilityList
          visibility={plusVisibility}
          onToggle={(id, v) => setPlusMenuItem(id, v)}
        />
      </Section>


      <Section title={t("settings.sec.data")}>
        <button
          onClick={handleExport}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-foreground/5 transition"
        >
          <Download size={18} className="text-muted-foreground" />
          <div className="flex-1">
            <div className="text-[15px]">{t("settings.data.export")}</div>
            <div className="text-[11px] text-muted-foreground">
              {t("settings.data.exportNote")}
            </div>
          </div>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-foreground/5 transition"
        >
          <Upload size={18} className="text-muted-foreground" />
          <div className="flex-1">
            <div className="text-[15px]">{t("settings.data.import")}</div>
            <div className="text-[11px] text-muted-foreground">
              {t("settings.data.importNote")}
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
        <Section title={t("settings.sec.migration")}>
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-foreground/5 transition disabled:opacity-60"
          >
            <CloudUpload size={18} className="text-muted-foreground" />
            <div className="flex-1">
              <div className="text-[15px]">
                {migrating ? t("settings.migration.movingLabel") : t("settings.migration.moveLabel")}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t("settings.migration.found", { entries: legacy.entries.length, products: legacy.products.length })}
              </div>
            </div>
          </button>
        </Section>
      )}

      <Section title={t("settings.sec.account")}>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-foreground/5 transition"
        >
          <LogOut size={18} className="text-muted-foreground" />
          <div className="flex-1">
            <div className="text-[15px]">{t("settings.account.logout")}</div>
          </div>
        </button>
      </Section>

      <Section title={t("settings.sec.feedback")}>
        <button
          onClick={() => setFeedbackOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-foreground/5 transition"
        >
          <MessageSquare size={18} className="text-muted-foreground" />
          <div className="flex-1">
            <div className="text-[15px]">{t("settings.feedback.send")}</div>
            <div className="text-[11px] text-muted-foreground">
              {t("settings.feedback.note")}
            </div>
          </div>
        </button>
      </Section>

      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      <Section title={t("settings.sec.danger")}>
        <button
          onClick={() => setResetOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-foreground/5 transition"
        >
          <Trash2 size={18} style={{ color: "#D64545" }} />
          <div className="flex-1">
            <div className="text-[15px]" style={{ color: "#D64545", fontWeight: 600 }}>
              {t("settings.danger.reset")}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t("settings.danger.resetNote")}
            </div>
          </div>
        </button>
      </Section>

      <AlertDialog open={resetOpen} onOpenChange={(v) => !resetting && setResetOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.danger.dialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.danger.dialogDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleResetData();
              }}
              disabled={resetCountdown > 0 || resetting}
              style={{
                background: "#D64545",
                color: "#FFF",
                opacity: resetCountdown > 0 || resetting ? 0.5 : 1,
              }}
            >
              {resetting
                ? t("settings.danger.deleting")
                : resetCountdown > 0
                  ? t("settings.danger.deleteCountdown", { n: resetCountdown })
                  : t("settings.danger.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="px-6 pt-2 pb-6 text-center text-[11px] text-muted-foreground">
        {t("settings.version")}

      </p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="px-[26px] pb-2">
        <h2
          className="text-[13px]"
          style={{ fontFamily: "Manrope, sans-serif", fontWeight: 700, color: "var(--ink)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="mt-0.5 text-[11px]"
            style={{ fontFamily: "Manrope, sans-serif", fontWeight: 600, color: "var(--muted-foreground)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
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
  const { t } = useTranslation();
  const opts: { v: Theme; l: string }[] = [
    { v: "light", l: t("settings.theme.light") },
    { v: "dark", l: t("settings.theme.dark") },
    { v: "system", l: t("settings.theme.system") },
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

const DAY_LABEL_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const cur: AppLang = (i18n.language?.startsWith("en") ? "en" : "pl") as AppLang;
  const opts: { v: AppLang; l: string }[] = [
    { v: "pl", l: t("settings.language.pl") },
    { v: "en", l: t("settings.language.en") },
  ];
  return (
    <div className="flex gap-0.5 rounded-full p-0.5" style={{ background: "var(--hairline)" }}>
      {opts.map((o) => {
        const active = cur === o.v;
        return (
          <button
            key={o.v}
            onClick={() => setAppLanguage(o.v)}
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


function WeeklyEditor({
  value,
  onChange,
}: {
  value: Record<string, DayMacro>;
  onChange: (dayIdx: number, m: Partial<DayMacro>) => void;
}) {
  const { t } = useTranslation();
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
        {DAY_LABEL_KEYS.map((key, i) => {
          const label = t(`settings.weekday.${key}`);
          const d = value[String(i)] ?? { protein: 0, carbs: 0, fat: 0 };
          const kcal = Math.round(d.protein * 4 + d.carbs * 4 + d.fat * 9);
          return (
            <div
              key={key}
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
  const { t } = useTranslation();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AssistantDefaultMeal)}
      className="rounded-lg border border-border/60 bg-card px-2 py-1 text-[13px]"
    >
      <option value="auto">{t("settings.assistant.defaultMealAuto")}</option>
      {(Object.keys(MEAL_LABEL) as Meal[]).map((m) => (
        <option key={m} value={m}>
          {t(`meal.${m}`)}
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
  const { t } = useTranslation();
  const opts: { v: AssistantResponseLength; l: string }[] = [
    { v: "short", l: t("settings.assistant.lenShort") },
    { v: "detailed", l: t("settings.assistant.lenLong") },
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

const PLUS_MENU_ICONS: Record<PlusMenuItemId, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  assistant: Sparkles,
  barcode: ScanLine,
  compound: Layers,
  search: SearchIcon,
  quick: Zap,
  manual: PencilLine,
};

function PlusMenuVisibilityList({
  visibility,
  onToggle,
}: {
  visibility: Record<string, boolean>;
  onToggle: (id: PlusMenuItemId, v: boolean) => void;
}) {
  const { t } = useTranslation();
  const enabledCount = PLUS_MENU_ITEMS.filter((id) => visibility[id] !== false).length;
  return (
    <>
      {PLUS_MENU_ITEMS.map((id) => {
        const Icon = PLUS_MENU_ICONS[id];
        const on = visibility[id] !== false;
        const lastOne = on && enabledCount <= 1;
        return (
          <div key={id} className="flex items-center gap-3 px-4 py-3.5">
            <span
              className="grid h-9 w-9 place-items-center rounded-xl"
              style={{ background: "var(--hairline)", color: "var(--ink)" }}
            >
              <Icon size={18} strokeWidth={1.9} />
            </span>
            <span
              className="flex-1 text-[15px]"
              style={{ fontFamily: "Manrope, sans-serif", fontWeight: 500, color: "var(--ink)" }}
            >
              {t(`settings.plusMenu.${id}`)}
            </span>
            <div className={lastOne ? "opacity-50 pointer-events-none" : ""}>
              <Switch
                checked={on}
                disabled={lastOne}
                onCheckedChange={(v) => onToggle(id, v)}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
