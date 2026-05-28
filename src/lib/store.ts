import { create } from "zustand";
import { persist } from "zustand/middleware";

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
}

export type Sex = "female" | "male";
export type Activity = "sedentary" | "light" | "moderate" | "high" | "very_high";
export type GoalKind = "cut" | "maintain" | "bulk";

export interface BodyProfile {
  sex: Sex;
  age: number;
  height: number; // cm
  weight: number; // kg
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
}

interface State {
  profile: Profile;
  entries: LogEntry[];
  addSheet: { open: boolean; meal?: Meal };
  openAdd: (meal?: Meal) => void;
  closeAdd: () => void;
  setTheme: (t: Theme) => void;
  setGoals: (g: Partial<Pick<Profile, "goal_kcal" | "goal_protein" | "goal_carbs" | "goal_fat">>) => void;
  setBody: (b: Partial<BodyProfile>) => void;
  addEntry: (e: Omit<LogEntry, "id" | "created_at">) => void;
  removeEntry: (id: string) => void;
  replaceAll: (data: { profile: Profile; entries: LogEntry[] }) => void;
}

const todayKcalDefault = 2200;

export const usePlate = create<State>()(
  persist(
    (set) => ({
      profile: {
        theme: "system",
        goal_kcal: todayKcalDefault,
        goal_protein: 150,
        goal_carbs: 240,
        goal_fat: 70,
      },
      entries: [],
      addSheet: { open: false },
      openAdd: (meal) => set({ addSheet: { open: true, meal } }),
      closeAdd: () => set((s) => ({ addSheet: { ...s.addSheet, open: false } })),
      setTheme: (theme) =>
        set((s) => ({ profile: { ...s.profile, theme } })),
      setGoals: (g) =>
        set((s) => ({ profile: { ...s.profile, ...g } })),
      setBody: (b) =>
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
        })),
      addEntry: (e) =>
        set((s) => ({
          entries: [
            ...s.entries,
            {
              ...e,
              id:
                (typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : String(Math.random()).slice(2)),
              created_at: Date.now(),
            },
          ],
        })),
      removeEntry: (id) =>
        set((s) => ({ entries: s.entries.filter((x) => x.id !== id) })),
      replaceAll: (data) =>
        set({ profile: data.profile, entries: data.entries }),
    }),
    { name: "plate-store-v1" }
  )
);

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: "Śniadanie",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
};

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
