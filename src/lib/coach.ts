import {
  type LogEntry,
  type Profile,
  computeGoals,
  getDayGoals,
  getWeekBalance,
  sumEntries,
  ymd,
} from "@/lib/store";
import type { WeightEntry } from "@/lib/weight";

const KCAL_PER_KG = 7700;

export interface CoachFacts {
  goalKind: "cut" | "maintain" | "bulk";
  planTDEE: number;
  planGoalKcal: number;
  windowDays: number;
  daysLogged: number;
  avgIntake: number;
  avgGoal: number;
  weekBalance: number;
  proteinGoal: number;
  proteinAvg: number;
  proteinHitRate: number; // 0..1
  weekdayAvg: number | null;
  weekendAvg: number | null;
  weekendDelta: number | null;
  weightLatest: number | null;
  weightDeltaKg: number | null;
  weightPerWeek: number | null;
  realTDEE: number | null;
  hasEnoughForReview: boolean;
}

function lastNDates(today: string, n: number): string[] {
  const out: string[] = [];
  const base = new Date(today + "T00:00:00");
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(ymd(d));
  }
  return out;
}

// 0 = Monday ... 6 = Sunday
function mondayIdx(dateStr: string): number {
  return (new Date(dateStr + "T00:00:00").getDay() + 6) % 7;
}

export function buildCoachFacts(
  entries: LogEntry[],
  profile: Profile,
  dayOffs: Set<string>,
  weightLog: WeightEntry[],
  today: string,
  windowDays = 14
): CoachFacts {
  const body = profile.body;
  const goalKind = body?.goal ?? "maintain";
  const computed = body ? computeGoals(body) : null;
  const planTDEE = computed?.tdee ?? profile.goal_kcal;
  const planGoalKcal = profile.goal_kcal;
  const proteinGoal = computed?.protein ?? profile.goal_protein;

  const dates = lastNDates(today, windowDays);
  const byDate = new Map<string, LogEntry[]>();
  for (const e of entries) {
    const list = byDate.get(e.date);
    if (list) list.push(e);
    else byDate.set(e.date, [e]);
  }

  let sumIntake = 0;
  let sumGoal = 0;
  let daysLogged = 0;
  let proteinSum = 0;
  let proteinHits = 0;
  let weekdaySum = 0;
  let weekdayN = 0;
  let weekendSum = 0;
  let weekendN = 0;

  for (const date of dates) {
    if (dayOffs.has(date)) continue;
    const tot = sumEntries(byDate.get(date) ?? []);
    if (tot.kcal <= 0) continue;
    const g = getDayGoals(profile, date);
    sumIntake += tot.kcal;
    sumGoal += g.kcal;
    proteinSum += tot.protein;
    if (g.protein > 0 && tot.protein >= g.protein * 0.95) proteinHits++;
    daysLogged++;
    if (mondayIdx(date) >= 5) {
      weekendSum += tot.kcal;
      weekendN++;
    } else {
      weekdaySum += tot.kcal;
      weekdayN++;
    }
  }

  const avgIntake = daysLogged ? Math.round(sumIntake / daysLogged) : 0;
  const avgGoal = daysLogged
    ? Math.round(sumGoal / daysLogged)
    : Math.round(planGoalKcal);
  const proteinAvg = daysLogged ? Math.round(proteinSum / daysLogged) : 0;
  const proteinHitRate = daysLogged ? proteinHits / daysLogged : 0;
  const weekdayAvg = weekdayN ? Math.round(weekdaySum / weekdayN) : null;
  const weekendAvg = weekendN ? Math.round(weekendSum / weekendN) : null;
  const weekendDelta =
    weekdayAvg != null && weekendAvg != null ? weekendAvg - weekdayAvg : null;

  // Weight trend + real-TDEE estimate over the window.
  const winStart = dates[dates.length - 1];
  const inWin = weightLog
    .filter((w) => w.date >= winStart && w.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const allSorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const weightLatest = allSorted.length
    ? allSorted[allSorted.length - 1].kg
    : null;
  let weightDeltaKg: number | null = null;
  let weightPerWeek: number | null = null;
  let realTDEE: number | null = null;
  if (inWin.length >= 2) {
    const first = inWin[0];
    const last = inWin[inWin.length - 1];
    const spanDays = Math.max(
      1,
      Math.round(
        (new Date(last.date + "T00:00:00").getTime() -
          new Date(first.date + "T00:00:00").getTime()) /
          86400000
      )
    );
    weightDeltaKg = Math.round((last.kg - first.kg) * 100) / 100;
    weightPerWeek = Math.round((weightDeltaKg / spanDays) * 7 * 100) / 100;
    if (daysLogged >= 7) {
      realTDEE = Math.round(avgIntake - (weightDeltaKg * KCAL_PER_KG) / spanDays);
    }
  }

  const wb = getWeekBalance(entries, profile, dayOffs, today);

  return {
    goalKind,
    planTDEE: Math.round(planTDEE),
    planGoalKcal: Math.round(planGoalKcal),
    windowDays,
    daysLogged,
    avgIntake,
    avgGoal,
    weekBalance: wb.balance,
    proteinGoal: Math.round(proteinGoal),
    proteinAvg,
    proteinHitRate: Math.round(proteinHitRate * 100) / 100,
    weekdayAvg,
    weekendAvg,
    weekendDelta,
    weightLatest,
    weightDeltaKg,
    weightPerWeek,
    realTDEE,
    hasEnoughForReview: daysLogged >= 3,
  };
}

// Deterministic fallback used when the AI call fails (offline / no key / error)
// so the coach always shows something useful.
export function fallbackCoachText(f: CoachFacts, lang: "pl" | "en"): string {
  const pl = lang !== "en";
  if (f.daysLogged === 0) {
    return pl
      ? "Brak wpisów z ostatnich dni — zaloguj kilka dni jedzenia, a podsumuję tydzień i podpowiem konkretne zmiany."
      : "No entries in the last few days — log a few days of food and I'll review the week and suggest concrete changes.";
  }
  const diff = f.avgIntake - f.avgGoal;
  const out: string[] = [];
  if (pl) {
    out.push(
      `Średnio ${f.avgIntake} kcal/dzień przy celu ${f.avgGoal} (${diff >= 0 ? "+" : ""}${diff}), ${f.daysLogged} dni zalogowanych.`
    );
    if (f.proteinHitRate < 0.6)
      out.push(
        `Białko trafiasz w ${Math.round(f.proteinHitRate * 100)}% dni — celuj w ${f.proteinGoal} g i dorzuć jeden produkt białkowy dziennie.`
      );
    if (f.weekendDelta != null && f.weekendDelta > 300)
      out.push(
        `Weekendy są o ${f.weekendDelta} kcal wyższe niż dni robocze — tam najczęściej ucieka deficyt.`
      );
    if (f.realTDEE != null)
      out.push(`Z Twoich danych realne TDEE wychodzi ~${f.realTDEE} kcal.`);
  } else {
    out.push(
      `Averaging ${f.avgIntake} kcal/day vs a ${f.avgGoal} goal (${diff >= 0 ? "+" : ""}${diff}), ${f.daysLogged} days logged.`
    );
    if (f.proteinHitRate < 0.6)
      out.push(
        `You hit protein ${Math.round(f.proteinHitRate * 100)}% of days — aim for ${f.proteinGoal} g and add one protein source daily.`
      );
    if (f.weekendDelta != null && f.weekendDelta > 300)
      out.push(
        `Weekends run ${f.weekendDelta} kcal higher than weekdays — that's usually where the deficit slips.`
      );
    if (f.realTDEE != null)
      out.push(`From your data your real TDEE looks like ~${f.realTDEE} kcal.`);
  }
  return out.join(" ");
}
