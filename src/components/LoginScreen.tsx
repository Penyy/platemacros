import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function LoginScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(t("login.accountCreated"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("login.tryAgain");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ambient-bg min-h-screen">
      <div
        className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col items-center px-7"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 2rem)",
          paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)",
        }}
      >
        {/* warm gold glow behind the logo */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
          style={{
            width: 360,
            height: 300,
            background:
              "radial-gradient(circle at 50% 30%, rgba(244,181,0,.16), transparent 62%)",
          }}
        />

        {/* logo + tagline */}
        <div className="relative z-10 mt-8 text-center">
          <div
            className="leading-[0.9]"
            style={{
              fontFamily: "Manrope, sans-serif",
              fontWeight: 800,
              fontSize: 72,
              letterSpacing: "-0.04em",
              color: "var(--ink)",
            }}
          >
            plate<span style={{ color: "var(--accent-yellow)" }}>.</span>
          </div>
          <div
            className="mt-3.5 text-[14.5px] font-semibold tracking-[-0.01em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            {t("login.tagline")}
          </div>
        </div>

        <div className="flex-1" />

        {/* form */}
        <form
          onSubmit={onSubmit}
          className="relative z-10 flex w-full flex-col gap-3"
        >
          <label
            className="block rounded-[18px] bg-card px-4 py-3 transition-shadow focus-within:[border-color:var(--accent-yellow)] focus-within:[box-shadow:0_0_0_3px_rgba(244,181,0,.16)]"
            style={{ border: "1px solid var(--hairline)" }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {t("login.email")}
            </div>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-0.5 w-full bg-transparent text-base font-bold outline-none"
              style={{ color: "var(--ink)" }}
              placeholder="you@example.com"
            />
          </label>

          <label
            className="block rounded-[18px] bg-card px-4 py-3 transition-shadow focus-within:[border-color:var(--accent-yellow)] focus-within:[box-shadow:0_0_0_3px_rgba(244,181,0,.16)]"
            style={{ border: "1px solid var(--hairline)" }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {t("login.password")}
            </div>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-0.5 w-full bg-transparent text-base font-bold outline-none"
              style={{ color: "var(--ink)" }}
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-[18px] bg-primary px-4 py-4 text-[15px] font-extrabold tracking-[-0.01em] text-primary-foreground active:opacity-90 disabled:opacity-60"
          >
            {loading
              ? t("login.working")
              : mode === "signup"
                ? t("login.createAccount")
                : t("login.signIn")}
          </button>
        </form>

        {/* disclaimer */}
        <div className="relative z-10 mt-5 flex w-full items-start gap-2.5">
          <ShieldCheck
            size={15}
            strokeWidth={1.8}
            className="mt-0.5 shrink-0"
            style={{ color: "var(--muted-foreground)" }}
          />
          <p
            className="text-[11.5px] font-medium leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            {t("login.disclaimer")}
          </p>
        </div>

        {/* toggle */}
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="relative z-10 mt-5 text-center text-sm font-semibold"
          style={{ color: "var(--muted-foreground)" }}
        >
          {mode === "login" ? (
            <>
              {t("login.noAccount")}{" "}
              <span style={{ color: "var(--accent-yellow)", fontWeight: 800 }}>
                {t("login.signUp")}
              </span>
            </>
          ) : (
            <>
              {t("login.haveAccount")}{" "}
              <span style={{ color: "var(--accent-yellow)", fontWeight: 800 }}>
                {t("login.signIn")}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
