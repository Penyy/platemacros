import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BottomNav } from "./BottomNav";
import { AddSheet } from "./AddSheet";
import { LoginScreen } from "./LoginScreen";
import { ymd, usePlate } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  const sheet = usePlate((s) => s.addSheet);
  const openAdd = usePlate((s) => s.openAdd);
  const closeAdd = usePlate((s) => s.closeAdd);
  const userId = usePlate((s) => s.userId);
  const authReady = usePlate((s) => s.authReady);
  const online = usePlate((s) => s.online);
  const pendingWrites = usePlate((s) => s.pendingWrites);
  const setAuth = usePlate((s) => s.setAuth);
  const setOnline = usePlate((s) => s.setOnline);
  const { t } = useTranslation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuth(session?.user?.id ?? null);
      },
    );
    void supabase.auth.getSession().then(({ data }) => {
      setAuth(data.session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, [setAuth]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [setOnline]);

  // Auto-select numeric inputs on focus/tap (iOS Safari friendly)
  useEffect(() => {
    const isNumeric = (el: EventTarget | null): el is HTMLInputElement => {
      if (!(el instanceof HTMLInputElement)) return false;
      const m = el.inputMode;
      return m === "numeric" || m === "decimal" || el.type === "number";
    };
    const selectAll = (el: HTMLInputElement) => {
      setTimeout(() => { try { el.select(); } catch { /* noop */ } }, 0);
    };
    const onFocusIn = (e: FocusEvent) => { if (isNumeric(e.target)) selectAll(e.target as HTMLInputElement); };
    const onClick = (e: MouseEvent) => { if (isNumeric(e.target)) selectAll(e.target as HTMLInputElement); };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("click", onClick);
    };
  }, []);

  if (!authReady) {
    return (
      <div className="ambient-bg flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Ładowanie…</div>
      </div>
    );
  }

  if (!userId) {
    return <LoginScreen />;
  }

  return (
    <div className="ambient-bg min-h-screen">
      {!online && (
        <div className="sticky top-0 z-50 bg-amber-500/90 px-4 py-1.5 text-center text-xs font-semibold text-black">
          Brak połączenia — zmiany zostaną zsynchronizowane po powrocie online.
        </div>
      )}
      {online && pendingWrites > 0 && (
        <div
          className="sticky top-0 z-40 px-4 py-1 text-center text-[11px] font-semibold text-muted-foreground"
          style={{ background: "var(--muted)" }}
        >
          {t("sync.pending", { count: pendingWrites })}
        </div>
      )}
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col">
        <main className="flex-1 pb-32">{children}</main>
      </div>
      <BottomNav onAdd={() => openAdd(undefined, undefined)} />
      <AddSheet
        open={sheet.open}
        defaultMeal={sheet.meal}
        date={sheet.date ?? ymd(new Date())}
        onClose={closeAdd}
      />
    </div>
  );
}
