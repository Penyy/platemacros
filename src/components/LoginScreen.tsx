import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function LoginScreen() {
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
        toast.success("Konto utworzone");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Spróbuj ponownie";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ambient-bg min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-6 pt-24">
        <h1 className="text-4xl font-bold tracking-tight">Plate</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "login"
            ? "Zaloguj się, aby zsynchronizować swoje dane."
            : "Załóż konto, aby zacząć liczyć kalorie."}
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-3">
          <label className="block rounded-2xl bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              E-mail
            </div>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-0.5 w-full bg-transparent text-base font-semibold outline-none"
              placeholder="ty@example.com"
            />
          </label>

          <label className="block rounded-2xl bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Hasło
            </div>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-0.5 w-full bg-transparent text-base font-semibold outline-none"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground active:opacity-90 disabled:opacity-60"
          >
            {loading
              ? "Pracuję…"
              : mode === "signup"
                ? "Załóż konto"
                : "Zaloguj się"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-6 text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "login"
            ? "Nie masz konta? Załóż"
            : "Masz już konto? Zaloguj się"}
        </button>
      </div>
    </div>
  );
}
