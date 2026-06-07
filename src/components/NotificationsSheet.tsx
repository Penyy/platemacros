import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { type Meal, MEAL_LABEL } from "@/lib/store";


export interface MealNotifSettings {
  enabled: boolean;
  times: Partial<Record<Meal, string>>; // "HH:MM"
}

const STORAGE_KEY = "plate.notifications.v1";
const DEFAULT_TIMES: Record<Meal, string> = {
  breakfast: "08:00",
  second_breakfast: "10:30",
  lunch: "13:00",
  dinner: "19:00",
  snack: "16:00",
};
const MEALS: Meal[] = ["breakfast", "second_breakfast", "lunch", "dinner", "snack"];

export function loadNotifSettings(): MealNotifSettings {
  if (typeof localStorage === "undefined") return { enabled: false, times: { ...DEFAULT_TIMES } };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, times: { ...DEFAULT_TIMES } };
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed.enabled,
      times: { ...DEFAULT_TIMES, ...(parsed.times ?? {}) },
    };
  } catch {
    return { enabled: false, times: { ...DEFAULT_TIMES } };
  }
}

function saveNotifSettings(s: MealNotifSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

export function NotificationsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [settings, setSettings] = useState<MealNotifSettings>(() => loadNotifSettings());
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  useEffect(() => {
    if (open) setSettings(loadNotifSettings());
  }, [open]);

  const update = (next: MealNotifSettings) => {
    setSettings(next);
    saveNotifSettings(next);
  };

  const onToggle = async (v: boolean) => {
    if (v && permission !== "unsupported" && permission !== "granted") {
      try {
        const p = await Notification.requestPermission();
        setPermission(p);
      } catch {
        /* noop */
      }
    }
    update({ ...settings, enabled: v });
  };

  const setTime = (meal: Meal, time: string) => {
    update({ ...settings, times: { ...settings.times, [meal]: time } });
  };

  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(navigator as any).standalone;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="border-0 p-0"
        style={{
          background: "var(--card)",
          color: "var(--ink)",
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingBottom: "max(env(safe-area-inset-bottom),1.5rem)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <SheetHeader className="px-5 pt-5 text-left">
          <SheetTitle style={{ color: "var(--ink)", fontWeight: 700, fontSize: 20 }}>
            Powiadomienia o posiłkach
          </SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-4 pt-4 space-y-4">
          <div
            className="flex items-center justify-between rounded-[20px] px-4 py-3.5"
            style={{ background: "var(--muted)", color: "var(--ink)" }}
          >
            <div>
              <div className="text-[15px] font-semibold">Przypomnienia o posiłkach</div>
              <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                Lokalne powiadomienia o ustawionej porze
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={onToggle}
              disabled={permission === "unsupported"}
            />
          </div>

          <div
            className="overflow-hidden rounded-[20px] divide-y"
            style={{ background: "var(--muted)", borderColor: "var(--hairline)" }}
          >
            {MEALS.map((m) => (
              <div key={m} className="flex items-center justify-between px-4 py-3">
                <span className="text-[14px]" style={{ color: "var(--ink)", fontWeight: 500 }}>
                  {MEAL_LABEL[m]}
                </span>
                <input
                  type="time"
                  value={settings.times[m] ?? DEFAULT_TIMES[m]}
                  onChange={(e) => setTime(m, e.target.value)}
                  className="num-tight rounded-xl px-2.5 py-1.5 text-[14px] outline-none"
                  style={{
                    background: "var(--card)",
                    color: "var(--ink)",
                    fontWeight: 700,
                    border: "1px solid var(--hairline)",
                  }}
                />
              </div>
            ))}
          </div>

          {permission === "denied" && (
            <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              Powiadomienia zostały zablokowane w przeglądarce. Włącz je w ustawieniach systemu.
            </p>
          )}
          {permission === "unsupported" && (
            <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              Twoja przeglądarka nie obsługuje powiadomień web.
            </p>
          )}
          {isIOS && (
            <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              Na iPhonie dodaj Plate do ekranu głównego (iOS 16.4+), aby powiadomienia
              działały niezawodnie. Pełne wsparcie pojawi się w wersji natywnej.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Local in-app reminder scheduler — fires Notification when within minute window.
let timerStarted = false;
export function startNotificationScheduler() {
  if (timerStarted) return;
  timerStarted = true;
  if (typeof Notification === "undefined") return;
  const fired = new Set<string>();
  const tick = () => {
    const s = loadNotifSettings();
    if (!s.enabled || Notification.permission !== "granted") return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const dayKey = now.toISOString().slice(0, 10);
    for (const m of MEALS) {
      const t = s.times[m] ?? DEFAULT_TIMES[m];
      if (t === hhmm) {
        const key = `${dayKey}:${m}`;
        if (!fired.has(key)) {
          fired.add(key);
          try {
            new Notification("Plate — czas na posiłek", {
              body: MEAL_LABEL[m],
              icon: "/icon-180.png",
            });
          } catch {
            /* noop */
          }
        }
      }
    }
  };
  setInterval(tick, 30_000);
  tick();
}

// Reuse user's existing usePlate type but reference to keep tree-shake happy
void usePlate;
