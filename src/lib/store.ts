import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export type Theme = "light" | "dark" | "system";

export interface LogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  meal: Meal;
  name: string;
  grams?: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: number;
  sub_items?: unknown;
}

export type Sex = "female" | "male";
export type Activity = "sedentary" | "light" | "moderate" | "high" | "very_high";
export type GoalKind = "cut" | "maintain" | "bulk";

export interface BodyProfile {
  sex: Sex;
  age: number;
  height: number;
  weight: number;
  activity: Activity;
  goal: GoalKind;
}

export interface Profile {
  theme: Theme;
  goal_kcal: number;
  goal_protein: number;
  goal_carbs: number;
  goal_fat: number;
  body?: BodyProfile;
  include_burned?: boolean;
}

export interface Product {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: number;
}

interface State {
  // auth
  userId: string | null;
  authReady: boolean;
  online: boolean;
  hydrated: boolean;
  // data
  profile: Profile;
  entries: LogEntry[];
  burned: Record<string, number>;
  products: Product[];
  // ui
  addSheet: { open: boolean; meal?: Meal };
  // ui actions
  openAdd: (meal?: Meal) => void;
  closeAdd: () => void;
  // auth actions
  setAuth: (userId: string | null) => void;
  setOnline: (v: boolean) => void;
  bootstrap: () => Promise<void>;
  clearLocal: () => void;
  // mutations
  setTheme: (t: Theme) => void;
  setGoals: (g: Partial<Pick<Profile, "goal_kcal" | "goal_protein" | "goal_carbs" | "goal_fat">>) => void;
  setBody: (b: Partial<BodyProfile>) => void;
  setIncludeBurned: (v: boolean) => void;
  setBurned: (date: string, kcal: number) => void;
  addEntry: (e: Omit<LogEntry, "id" | "created_at">) => void;
  removeEntry: (id: string) => void;
  repeatMealFromPrevDay: (date: string, meal: Meal) => number;
  addProduct: (p: Omit<Product, "id" | "created_at">) => void;
  updateProduct: (id: string, p: Partial<Omit<Product, "id" | "created_at">>) => void;
  removeProduct: (id: string) => void;
  replaceAll: (data: { profile: Profile; entries: LogEntry[]; burned?: Record<string, number>; products?: Product[] }) => Promise<void>;
}

const defaultProfile: Profile = {
  theme: "system",
  goal_kcal: 2200,
  goal_protein: 130,
  goal_carbs: 250,
  goal_fat: 70,
  include_burned: false,
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random()).slice(2) + String(Date.now());
}

function netToast(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/network|fetch|offline/i.test(msg) || !navigator.onLine) {
    toast.message("Brak połączenia — zmiany nie zostały zsynchronizowane.");
  } else {
    toast.error("Błąd zapisu: " + msg);
  }
}

export const usePlate = create<State>()((set, get) => ({
  userId: null,
  authReady: false,
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  hydrated: false,
  profile: defaultProfile,
  entries: [],
  burned: {},
  products: [],
  addSheet: { open: false },

  openAdd: (meal) => set({ addSheet: { open: true, meal } }),
  closeAdd: () => set((s) => ({ addSheet: { ...s.addSheet, open: false } })),

  setAuth: (userId) => {
    set({ userId, authReady: true });
    if (userId) {
      void get().bootstrap();
    } else {
      get().clearLocal();
    }
  },
  setOnline: (v) => set({ online: v }),

  clearLocal: () =>
    set({
      profile: defaultProfile,
      entries: [],
      burned: {},
      products: [],
      hydrated: false,
    }),

  bootstrap: async () => {
    const uid = get().userId;
    if (!uid) return;
    try {
      const [profRes, entRes, foodRes, burnRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("food_entries").select("*").eq("user_id", uid).order("created_at"),
        supabase.from("foods").select("*").eq("user_id", uid).order("created_at"),
        supabase.from("daily_burned").select("date,burned_kcal").eq("user_id", uid),
      ]);

      const prof = profRes.data;
      const profile: Profile = prof
        ? {
            theme: (prof.theme as Theme) ?? "system",
            goal_kcal: Number(prof.goal_kcal) || 2200,
            goal_protein: Number(prof.goal_protein) || 130,
            goal_carbs: Number(prof.goal_carbs) || 250,
            goal_fat: Number(prof.goal_fat) || 70,
            include_burned: !!prof.consider_burned,
            body: (prof.activity_profile as BodyProfile | null) ?? undefined,
          }
        : defaultProfile;

      const entries: LogEntry[] = (entRes.data ?? []).map((r) => ({
        id: r.id,
        date: r.date,
        meal: r.meal as Meal,
        name: r.name,
        grams: r.grams != null ? Number(r.grams) : undefined,
        kcal: Number(r.kcal),
        protein: Number(r.protein),
        carbs: Number(r.carbs),
        fat: Number(r.fat),
        created_at: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        sub_items: r.sub_items ?? undefined,
      }));

      const products: Product[] = (foodRes.data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        kcal: Number(r.kcal_100),
        protein: Number(r.protein_100),
        carbs: Number(r.carbs_100),
        fat: Number(r.fat_100),
        created_at: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      }));

      const burned: Record<string, number> = {};
      for (const r of burnRes.data ?? []) {
        burned[r.date] = Number(r.burned_kcal) || 0;
      }

      set({ profile, entries, products, burned, hydrated: true });
    } catch (err) {
      console.error("bootstrap failed", err);
      toast.message("Brak połączenia — pokazuję ostatnio załadowane dane.");
      set({ hydrated: true });
    }
  },

  setTheme: (theme) => {
    set((s) => ({ profile: { ...s.profile, theme } }));
    const uid = get().userId;
    if (!uid) return;
    void supabase.from("profiles").update({ theme }).eq("id", uid).then(({ error }) => {
      if (error) netToast(error);
    });
  },

  setGoals: (g) => {
    set((s) => ({ profile: { ...s.profile, ...g } }));
    const uid = get().userId;
    if (!uid) return;
    void supabase.from("profiles").update(g).eq("id", uid).then(({ error }) => {
      if (error) netToast(error);
    });
  },

  setBody: (b) => {
    set((s) => ({
      profile: {
        ...s.profile,
        body: {
          sex: s.profile.body?.sex ?? "female",
          age: s.profile.body?.age ?? 30,
          height: s.profile.body?.height ?? 170,
          weight: s.profile.body?.weight ?? 70,
          activity: s.profile.body?.activity ?? "moderate",
          goal: s.profile.body?.goal ?? "maintain",
          ...b,
        },
      },
    }));
    const uid = get().userId;
    if (!uid) return;
    const body = get().profile.body;
    void supabase
      .from("profiles")
      .update({ activity_profile: (body ?? null) as unknown as Json })
      .eq("id", uid)
      .then(({ error }) => {
        if (error) netToast(error);
      });
  },

  setIncludeBurned: (v) => {
    set((s) => ({ profile: { ...s.profile, include_burned: v } }));
    const uid = get().userId;
    if (!uid) return;
    void supabase
      .from("profiles")
      .update({ consider_burned: v })
      .eq("id", uid)
      .then(({ error }) => {
        if (error) netToast(error);
      });
  },

  setBurned: (date, kcal) => {
    set((s) => {
      const next = { ...s.burned };
      if (!kcal || kcal <= 0) delete next[date];
      else next[date] = Math.round(kcal);
      return { burned: next };
    });
    const uid = get().userId;
    if (!uid) return;
    if (!kcal || kcal <= 0) {
      void supabase
        .from("daily_burned")
        .delete()
        .eq("user_id", uid)
        .eq("date", date)
        .then(({ error }) => {
          if (error) netToast(error);
        });
    } else {
      void supabase
        .from("daily_burned")
        .upsert(
          { user_id: uid, date, burned_kcal: Math.round(kcal) },
          { onConflict: "user_id,date" }
        )
        .then(({ error }) => {
          if (error) netToast(error);
        });
    }
  },

  addEntry: (e) => {
    const uid = get().userId;
    const id = newId();
    const created_at = Date.now();
    const entry: LogEntry = { ...e, id, created_at };
    set((s) => ({ entries: [...s.entries, entry] }));
    if (!uid) return;
    void supabase
      .from("food_entries")
      .insert({
        id,
        user_id: uid,
        date: e.date,
        meal: e.meal,
        name: e.name,
        grams: e.grams ?? null,
        kcal: e.kcal,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
        sub_items: (e.sub_items ?? null) as Json,
      })
      .then(({ error }) => {
        if (error) netToast(error);
      });
  },

  removeEntry: (id) => {
    set((s) => ({ entries: s.entries.filter((x) => x.id !== id) }));
    const uid = get().userId;
    if (!uid) return;
    void supabase
      .from("food_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", uid)
      .then(({ error }) => {
        if (error) netToast(error);
      });
  },

  addProduct: (p) => {
    const uid = get().userId;
    const id = newId();
    const created_at = Date.now();
    set((s) => ({ products: [...s.products, { ...p, id, created_at }] }));
    if (!uid) return;
    void supabase
      .from("foods")
      .insert({
        id,
        user_id: uid,
        name: p.name,
        kcal_100: p.kcal,
        protein_100: p.protein,
        carbs_100: p.carbs,
        fat_100: p.fat,
      })
      .then(({ error }) => {
        if (error) netToast(error);
      });
  },

  updateProduct: (id, p) => {
    set((s) => ({
      products: s.products.map((x) => (x.id === id ? { ...x, ...p } : x)),
    }));
    const uid = get().userId;
    if (!uid) return;
    const dbPatch: Record<string, unknown> = {};
    if (p.name !== undefined) dbPatch.name = p.name;
    if (p.kcal !== undefined) dbPatch.kcal_100 = p.kcal;
    if (p.protein !== undefined) dbPatch.protein_100 = p.protein;
    if (p.carbs !== undefined) dbPatch.carbs_100 = p.carbs;
    if (p.fat !== undefined) dbPatch.fat_100 = p.fat;
    void supabase
      .from("foods")
      .update(dbPatch as never)
      .eq("id", id)
      .eq("user_id", uid)
      .then(({ error }) => {
        if (error) netToast(error);
      });
  },

  removeProduct: (id) => {
    set((s) => ({ products: s.products.filter((x) => x.id !== id) }));
    const uid = get().userId;
    if (!uid) return;
    void supabase
      .from("foods")
      .delete()
      .eq("id", id)
      .eq("user_id", uid)
      .then(({ error }) => {
        if (error) netToast(error);
      });
  },

  replaceAll: async (data) => {
    const uid = get().userId;
    set({
      profile: data.profile,
      entries: data.entries,
      burned: data.burned ?? {},
      products: data.products ?? [],
    });
    if (!uid) return;
    try {
      // wipe existing rows
      await Promise.all([
        supabase.from("food_entries").delete().eq("user_id", uid),
        supabase.from("foods").delete().eq("user_id", uid),
        supabase.from("daily_burned").delete().eq("user_id", uid),
      ]);
      // upsert profile
      await supabase
        .from("profiles")
        .update({
          theme: data.profile.theme,
          goal_kcal: data.profile.goal_kcal,
          goal_protein: data.profile.goal_protein,
          goal_carbs: data.profile.goal_carbs,
          goal_fat: data.profile.goal_fat,
          consider_burned: !!data.profile.include_burned,
          activity_profile: (data.profile.body ?? null) as unknown as Json,
        })
        .eq("id", uid);
      // insert entries
      if (data.entries.length > 0) {
        await supabase.from("food_entries").insert(
          data.entries.map((e) => ({
            id: e.id || newId(),
            user_id: uid,
            date: e.date,
            meal: e.meal,
            name: e.name,
            grams: e.grams ?? null,
            kcal: e.kcal,
            protein: e.protein,
            carbs: e.carbs,
            fat: e.fat,
            sub_items: (e.sub_items ?? null) as Json,
          }))
        );
      }
      if ((data.products ?? []).length > 0) {
        await supabase.from("foods").insert(
          (data.products ?? []).map((p) => ({
            id: p.id || newId(),
            user_id: uid,
            name: p.name,
            kcal_100: p.kcal,
            protein_100: p.protein,
            carbs_100: p.carbs,
            fat_100: p.fat,
          }))
        );
      }
      const burnedRows = Object.entries(data.burned ?? {}).map(([date, kcal]) => ({
        user_id: uid,
        date,
        burned_kcal: Math.round(kcal),
      }));
      if (burnedRows.length > 0) {
        await supabase
          .from("daily_burned")
          .upsert(burnedRows, { onConflict: "user_id,date" });
      }
    } catch (err) {
      netToast(err);
    }
  },
}));

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: "Śniadanie",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
};

export const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: "Siedzący",
  light: "Lekka",
  moderate: "Umiarkowana",
  high: "Wysoka",
  very_high: "Bardzo wysoka",
};

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
};

export const GOAL_LABEL: Record<GoalKind, string> = {
  cut: "Redukcja",
  maintain: "Utrzymanie",
  bulk: "Budowa masy",
};

export interface ComputedGoals {
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function computeGoals(b: BodyProfile): ComputedGoals {
  const base = 10 * b.weight + 6.25 * b.height - 5 * b.age;
  const bmr = b.sex === "male" ? base + 5 : base - 161;
  const tdee = bmr * ACTIVITY_FACTOR[b.activity];
  const kcal =
    b.goal === "cut" ? tdee * 0.8 : b.goal === "bulk" ? tdee * 1.12 : tdee;
  const protein = 2 * b.weight;
  const fat = 0.9 * b.weight;
  const remaining = Math.max(0, kcal - protein * 4 - fat * 9);
  const carbs = remaining / 4;
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}

export function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function sumEntries(entries: LogEntry[]) {
  return entries.reduce(
    (a, e) => ({
      kcal: a.kcal + e.kcal,
      protein: a.protein + e.protein,
      carbs: a.carbs + e.carbs,
      fat: a.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

// =====================================================================
// Legacy localStorage migration helper
// =====================================================================
const LEGACY_KEY = "plate-store-v1";

export interface LegacyData {
  profile: Profile;
  entries: LogEntry[];
  burned: Record<string, number>;
  products: Product[];
}

export function readLegacyLocalStorage(): LegacyData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const s = parsed?.state ?? parsed;
    if (!s) return null;
    const hasData =
      (Array.isArray(s.entries) && s.entries.length > 0) ||
      (Array.isArray(s.products) && s.products.length > 0) ||
      (s.burned && Object.keys(s.burned).length > 0) ||
      (s.profile && (s.profile.goal_kcal !== 2200 || s.profile.body));
    if (!hasData) return null;
    return {
      profile: s.profile ?? defaultProfile,
      entries: Array.isArray(s.entries) ? s.entries : [],
      burned: s.burned ?? {},
      products: Array.isArray(s.products) ? s.products : [],
    };
  } catch {
    return null;
  }
}

export function clearLegacyLocalStorage() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* noop */
  }
}
