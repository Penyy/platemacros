import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Switch } from "@/components/ui/switch";
import { type Theme, usePlate } from "@/lib/store";

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
  const setTheme = usePlate((s) => s.setTheme);
  const setGoals = usePlate((s) => s.setGoals);
  const setIncludeBurned = usePlate((s) => s.setIncludeBurned);
  const replaceAll = usePlate((s) => s.replaceAll);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleExport() {
    const payload = {
      app: "plate",
      version: 1,
      exported_at: new Date().toISOString(),
      profile,
      entries,
      burned,
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
      if (!data || typeof data !== "object" || !data.profile || !Array.isArray(data.entries)) {
        alert("Nieprawidłowy plik kopii zapasowej.");
        return;
      }
      const ok = confirm(
        `Importować ${data.entries.length} wpisów? Obecne dane zostaną nadpisane.`
      );
      if (!ok) return;
      replaceAll({
        profile: data.profile,
        entries: data.entries,
        burned: data.burned && typeof data.burned === "object" ? data.burned : {},
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
      <h2 className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="mx-3 divide-y divide-border/60 overflow-hidden rounded-2xl bg-card">
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
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-[15px]">{label}</span>
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
          className="num-tight w-20 rounded-lg bg-foreground/5 px-2 py-1 text-right text-[15px] font-semibold outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="w-7 text-left text-xs text-muted-foreground">{unit}</span>
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
    <div className="flex gap-0.5 rounded-full bg-foreground/5 p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            value === o.v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
