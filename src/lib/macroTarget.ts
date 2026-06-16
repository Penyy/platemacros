// Single source of truth for "did this land on target?" — used by the Today
// macro bars / kcal ring reward and by the streak stats in Stats.
export type MacroKind = "protein" | "carbs" | "fat" | "kcal";

// Band for ceiling-style macros: the larger of 5 g or 5% of the goal.
export function targetTolerance(goal: number): number {
  return Math.max(5, Math.round(goal * 0.05));
}

// protein & kcal = floor (reaching the goal counts, more is fine).
// carbs & fat = band around the goal (a ceiling you try to land near).
export function isOnTarget(kind: MacroKind, cur: number, goal: number): boolean {
  if (!(goal > 0)) return false;
  if (kind === "protein" || kind === "kcal") return cur >= goal;
  return Math.abs(cur - goal) <= targetTolerance(goal);
}

export interface MacroTriplet {
  protein: number;
  carbs: number;
  fat: number;
}

// A "perfect day" hits all three macros (kcal is rewarded separately on the ring).
export function isPerfectMacroDay(totals: MacroTriplet, goals: MacroTriplet): boolean {
  return (
    isOnTarget("protein", totals.protein, goals.protein) &&
    isOnTarget("carbs", totals.carbs, goals.carbs) &&
    isOnTarget("fat", totals.fat, goals.fat)
  );
}
