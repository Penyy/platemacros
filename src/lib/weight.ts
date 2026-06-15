// Lightweight weight log. Stored locally for now (no DB migration); the coach
// reads it client-side. Swapping to a synced Supabase table later only means
// replacing load/upsert/remove with async calls.
export interface WeightEntry {
  date: string; // YYYY-MM-DD
  kg: number;
}

const KEY = "plate_weight_log_v1";

export function loadWeightLog(): WeightEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (e): e is WeightEntry =>
          e &&
          typeof e.date === "string" &&
          typeof e.kg === "number" &&
          Number.isFinite(e.kg)
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

function persist(log: WeightEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    /* ignore quota / private mode */
  }
}

export function upsertWeight(date: string, kg: number): WeightEntry[] {
  const clamped = Math.min(400, Math.max(20, kg));
  const log = loadWeightLog().filter((e) => e.date !== date);
  log.push({ date, kg: Math.round(clamped * 10) / 10 });
  log.sort((a, b) => a.date.localeCompare(b.date));
  persist(log);
  return log;
}

export function removeWeight(date: string): WeightEntry[] {
  const log = loadWeightLog().filter((e) => e.date !== date);
  persist(log);
  return log;
}
