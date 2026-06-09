import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Download,
  Upload,
  LogOut,
  CloudUpload,
  MessageSquare,
  Layers,
  Zap,
  PencilLine,
  Search as SearchIcon,
  ScanLine,
  Sparkles,
  Trash2,
  ChevronRight,
  Target,
} from "lucide-react";
import { setAppLanguage, type AppLang } from "@/lib/i18n";
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
      `Przenieść ${legacy.entries.length} wpisów i ${legacy.products.length} produktów do chmury? Obecne dane w chmurze zostaną nadpisane.`,
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
    toast.success(t("data.exportDone"));
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== "object") {
        alert(t("data.importError"));
        return;
      }

      if (Array.isArray((data as any).myFoods)) {
        const converted = convertMacroFlow((data as any).myFoods);
        if (converted.length === 0) {
          alert(t("data.macroflowEmpty"));
          return;
        }
        const ok = confirm(t("data.macroflowConfirm", { n: converted.length }));
        if (!ok) return;
        await replaceAll({
          profile,
          entries: [...entries, ...converted],
          burned,
          products,
        });
        toast.success(t("data.macroflowDone", { n: converted.length }));
        return;
      }

      if (!data.profile || !Array.isArray(data.entries)) {
        alert(t("data.importError"));
        return;
      }
      const ok = confirm(t("data.importConfirm", { n: data.entries.length }));
      if (!ok) return;
      await replaceAll({
        profile: data.profile,
        entries: data.entries,
        burned: data.burned && typeof data.burned === "object" ? data.burned : {},
        products: Array.isArray(data.products) ? data.products : [],
      });
      toast.success(t("data.importDone"));
    } catch {
      alert(t("data.importError"));
    }
  }

  const assistant = profile.assistant ?? defaultAssistantSettings;

  return (
    <div className="pb-8">
      <ScreenHeader title={t("settings.title")} />

      {/* A) APLIKACJA */}
      <Section title={t("settings.sec.app")}>
        <Row label={t("settings.theme.label")}>
          <ThemeSelect value={profile.theme} onChange={(th) => setTheme(th)} />
        </Row>
        <Row label={t("settings.language.label")}>
          <LanguageSelect />
        </Row>
      </Section>

      {/* B) CELE I KALORIE */}
      <Section title={t("settings.sec.goals")}>
        <LinkRow
          label={t("settings.goals.dailyTitle")}
          subtitle={t("settings.goals.editInProfile")}
          value={`${profile.goal_kcal} ${t("settings.goals.unitKcal")}`}
          onClick={() => navigate({ to: "/profile" })}
        />
        <RowWithSub
          label={t("settings.weekly.switch")}
          subtitle={t("settings.weekly.note")}
        >
          <AccentSwitch
            checked={!!profile.weekly_targets_enabled}
            onCheckedChange={(v) => setWeeklyEnabled(v)}
          />
        </RowWithSub>
        {profile.weekly_targets_enabled && (
          <WeeklyEditor
            value={profile.weekly_macro_targets ?? seedWeeklyFromProfile(profile)}
            onChange={(idx, m) => setWeeklyDay(idx, m)}
          />
        )}
        <RowWithSub
          label={t("settings.activity.includeBurned")}
          subtitle={t("settings.activity.note")}
        >
          <AccentSwitch
            checked={!!profile.include_burned}
            onCheckedChange={(v) => setIncludeBurned(v)}
          />
        </RowWithSub>
      </Section>

      {/* C) ASYSTENT AI */}
      <Section title={t("settings.sec.assistant")}>
        <RowWithSub
          label={t("settings.assistant.autoAddPhoto")}
          subtitle={t("settings.assistant.autoAddPhotoNote")}
        >
          <AccentSwitch
            checked={assistant.autoAddPhoto}
            onCheckedChange={(v) => setAssistant({ autoAddPhoto: v })}
          />
        </RowWithSub>
        <RowWithSub
          label={t("settings.assistant.allowAddEntries")}
          subtitle={t("settings.assistant.allowAddEntriesNote")}
        >
          <AccentSwitch
            checked={assistant.allowAddEntries}
            onCheckedChange={(v) => setAssistant({ allowAddEntries: v })}
          />
        </RowWithSub>
        <Row label={t("settings.assistant.defaultMeal")}>
          <DefaultMealSelect
            value={assistant.defaultMeal}
            onChange={(v) => setAssistant({ defaultMeal: v })}
          />
        </Row>
        <Row label={t("settings.assistant.responseLength")}>
          <ResponseLengthSelect
            value={assistant.responseLength}
            onChange={(v) => setAssistant({ responseLength: v })}
          />
        </Row>
      </Section>

      {/* D) MENU DODAWANIA */}
      <Section
        title={t("settings.sec.plusMenu")}
        subtitle={t("settings.sec.plusMenuSubtitle")}
      >
        <PlusMenuVisibilityList
          visibility={plusVisibility}
          onToggle={(id, v) => setPlusMenuItem(id, v)}
        />
      </Section>

      {/* E) DANE */}
      <Section title={t("settings.sec.data")}>
        <IconActionRow
          icon={<Download size={18} strokeWidth={1.9} />}
          label={t("data.export")}
          subtitle={t("data.exportHint")}
          onClick={handleExport}
        />
        <IconActionRow
          icon={<Upload size={18} strokeWidth={1.9} />}
          label={t("data.import")}
          subtitle={t("data.importHint")}
          onClick={() => fileRef.current?.click()}
        />
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
          <IconActionRow
            icon={<CloudUpload size={18} strokeWidth={1.9} />}
            label={
              migrating
                ? t("settings.migration.movingLabel")
                : t("settings.migration.moveLabel")
            }
            subtitle={t("settings.migration.found", {
              entries: legacy.entries.length,
              products: legacy.products.length,
            })}
            onClick={handleMigrate}
            disabled={migrating}
          />
        </Section>
      )}

      {/* F) KONTO */}
      <Section title={t("settings.sec.account")}>
        <IconActionRow
          icon={<LogOut size={18} strokeWidth={1.9} />}
          label={t("settings.account.logout")}
          onClick={handleLogout}
        />
        <IconActionRow
          icon={<MessageSquare size={18} strokeWidth={1.9} />}
          label={t("feedback.send")}
          subtitle={t("settings.feedback.note")}
          onClick={() => setFeedbackOpen(true)}
          chevron
        />
      </Section>

      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      {/* G) STREFA ZAGROŻENIA */}
      <Section title={t("settings.sec.danger")}>
        <button
          onClick={() => setResetOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-foreground/5"
        >
          <span
            className="grid h-9 w-9 place-items-center rounded-xl"
            style={{
              background: "color-mix(in oklab, var(--macro-protein) 14%, transparent)",
              color: "var(--macro-protein)",
            }}
          >
            <Trash2 size={18} strokeWidth={1.9} />
          </span>
          <div className="flex-1">
            <div
              className="text-[15px]"
              style={{ color: "var(--macro-protein)", fontWeight: 700 }}
            >
              {t("settings.danger.reset")}
            </div>
            <div
              className="mt-0.5 text-[12px]"
              style={{ color: "var(--muted-foreground)" }}
            >
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
            <AlertDialogCancel disabled={resetting}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleResetData();
              }}
              disabled={resetCountdown > 0 || resetting}
              style={{
                background: "var(--macro-protein)",
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

      {/* H) STOPKA */}
      <p
        className="px-6 pt-6 pb-2 text-center text-[11px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        {t("settings.version")}
      </p>
    </div>
  );
}

/* ============================== Building blocks ============================ */

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
    <div className="mt-5">
      <div className="px-[26px] pb-2">
        <h2
          className="text-[11px] uppercase"
          style={{
            fontFamily: "Manrope, sans-serif",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--muted-foreground)",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="mt-1 text-[12px]"
            style={{
              fontFamily: "Manrope, sans-serif",
              color: "var(--muted-foreground)",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div
        className="mx-[18px] divide-y overflow-hidden rounded-[20px] border bg-card"
        style={{
          borderColor: "var(--hairline)",
          boxShadow: "var(--shadow-card)",
        }}
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
      <span
        className="text-[15px]"
        style={{ color: "var(--ink)", fontWeight: 700 }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function RowWithSub({
  label,
  subtitle,
  children,
}: {
  label: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div
          className="text-[15px]"
          style={{ color: "var(--ink)", fontWeight: 700 }}
        >
          {label}
        </div>
        {subtitle && (
          <div
            className="mt-0.5 text-[12px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function LinkRow({
  label,
  subtitle,
  value,
  onClick,
}: {
  label: string;
  subtitle?: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-foreground/5"
    >
      <span
        className="grid h-9 w-9 place-items-center rounded-xl"
        style={{ background: "var(--hairline)", color: "var(--ink)" }}
      >
        <Target size={18} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px]" style={{ color: "var(--ink)", fontWeight: 700 }}>
          {label}
        </div>
        {subtitle && (
          <div
            className="mt-0.5 text-[12px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {value && (
        <span
          className="num-tight text-[14px]"
          style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
        >
          {value}
        </span>
      )}
      <ChevronRight
        size={18}
        strokeWidth={1.9}
        style={{ color: "var(--muted-foreground)", opacity: 0.6 }}
      />
    </button>
  );
}

function IconActionRow({
  icon,
  label,
  subtitle,
  onClick,
  disabled,
  chevron,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  onClick: () => void;
  disabled?: boolean;
  chevron?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-foreground/5 disabled:opacity-60"
    >
      <span
        className="grid h-9 w-9 place-items-center rounded-xl"
        style={{ background: "var(--hairline)", color: "var(--ink)" }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px]" style={{ color: "var(--ink)", fontWeight: 700 }}>
          {label}
        </div>
        {subtitle && (
          <div
            className="mt-0.5 text-[12px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {chevron && (
        <ChevronRight
          size={18}
          strokeWidth={1.9}
          style={{ color: "var(--muted-foreground)", opacity: 0.6 }}
        />
      )}
    </button>
  );
}

/* ============================== Controls ================================== */

function AccentSwitch(props: React.ComponentProps<typeof Switch>) {
  return (
    <Switch
      {...props}
      className="data-[state=checked]:bg-[var(--accent-yellow)] data-[state=unchecked]:bg-[var(--hairline)]"
    />
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; l: string }[];
}) {
  return (
    <div
      className="flex gap-0.5 rounded-full p-0.5"
      style={{ background: "var(--hairline)" }}
    >
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className="rounded-full px-3 py-1 text-xs transition"
            style={{
              background: active ? "var(--ink)" : "transparent",
              color: active ? "var(--card)" : "var(--muted-foreground)",
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

function ThemeSelect({
  value,
  onChange,
}: {
  value: Theme;
  onChange: (t: Theme) => void;
}) {
  const { t } = useTranslation();
  return (
    <Segmented<Theme>
      value={value}
      onChange={onChange}
      options={[
        { v: "light", l: t("settings.theme.light") },
        { v: "dark", l: t("settings.theme.dark") },
        { v: "system", l: t("settings.theme.system") },
      ]}
    />
  );
}

const DAY_LABEL_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const cur: AppLang = (i18n.language?.startsWith("en") ? "en" : "pl") as AppLang;
  return (
    <Segmented<AppLang>
      value={cur}
      onChange={(v) => setAppLanguage(v)}
      options={[
        { v: "pl", l: t("settings.language.pl") },
        { v: "en", l: t("settings.language.en") },
      ]}
    />
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
              <span className="text-[11px] font-semibold text-muted-foreground">
                {label}
              </span>
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
      style={{ color: "var(--ink)", fontWeight: 600 }}
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
  return (
    <Segmented<AssistantResponseLength>
      value={value}
      onChange={onChange}
      options={[
        { v: "short", l: t("settings.assistant.lenShort") },
        { v: "detailed", l: t("settings.assistant.lenLong") },
      ]}
    />
  );
}

const PLUS_MENU_ICONS: Record<
  PlusMenuItemId,
  React.ComponentType<{ size?: number; strokeWidth?: number }>
> = {
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
              style={{
                fontFamily: "Manrope, sans-serif",
                fontWeight: 700,
                color: "var(--ink)",
              }}
            >
              {t(`settings.plusMenu.${id}`)}
            </span>
            <div className={lastOne ? "pointer-events-none opacity-50" : ""}>
              <AccentSwitch
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
