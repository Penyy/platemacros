import type { Product } from "@/lib/store";

// "How well does this portion fit what's left of the day?" — pure arithmetic,
// protein-first. No AI. All numbers come from the diary + the OFF product.

export interface DayRemaining {
  kcal: number; // goal - consumed (can be <= 0 if already over)
  protein: number;
  carbs: number;
  fat: number;
  goalKcal: number;
}

export interface PortionMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type FitLevel = "great" | "ok" | "poor" | "none";

export type FitReason =
  | { kind: "no_goal" }
  | { kind: "over_kcal"; overBy: number; gramsThatFit: number | null }
  | { kind: "fits_protein"; proteinAdd: number; proteinGap: number }
  | { kind: "fits_neutral" }
  | { kind: "low_protein"; proteinAdd: number; proteinGap: number };

export interface FitResult {
  level: FitLevel;
  reason: FitReason;
}

// Ignore a tiny kcal overshoot (~5% of the daily goal, min 40 kcal) so a sliver
// over budget isn't punished — the macro picture decides instead.
function kcalTolerance(goalKcal: number): number {
  return Math.max(40, Math.round(goalKcal * 0.05));
}

function proteinDensity(m: PortionMacros): number {
  return m.kcal > 0 ? (m.protein * 4) / m.kcal : 0;
}

export function computeFit(
  portion: PortionMacros,
  rem: DayRemaining,
  currentGrams: number
): FitResult {
  if (!rem.goalKcal || rem.goalKcal <= 0) {
    return { level: "none", reason: { kind: "no_goal" } };
  }
  const tol = kcalTolerance(rem.goalKcal);
  const remKcal = rem.kcal;
  const fitsKcal = remKcal > 0 && portion.kcal <= remKcal + tol;

  if (!fitsKcal) {
    const overBy = Math.round(portion.kcal - Math.max(0, remKcal));
    const gramsThatFit =
      remKcal > 0 && portion.kcal > 0
        ? Math.max(0, Math.round((currentGrams * remKcal) / portion.kcal))
        : 0;
    return {
      level: "poor",
      reason: { kind: "over_kcal", overBy, gramsThatFit },
    };
  }

  // Fits the kcal budget → judge by protein (the user's priority).
  const gap = Math.max(0, Math.round(rem.protein));
  const pAdd = Math.round(portion.protein);
  const dense = proteinDensity(portion) >= 0.25;

  if (gap <= 0) {
    // Protein already met for the day and it fits — fine, nothing special.
    return { level: "ok", reason: { kind: "fits_neutral" } };
  }

  const coverage = pAdd / gap;
  if (coverage >= 0.25 || (dense && pAdd >= 0.2 * gap)) {
    return {
      level: "great",
      reason: { kind: "fits_protein", proteinAdd: pAdd, proteinGap: gap },
    };
  }
  if (coverage >= 0.1 || dense) {
    return { level: "ok", reason: { kind: "fits_neutral" } };
  }
  return {
    level: "poor",
    reason: { kind: "low_protein", proteinAdd: pAdd, proteinGap: gap },
  };
}

export interface SwapSuggestion {
  product: Product;
  kcalPer100: number;
  proteinPer100: number;
}

// Suggest a clearly more protein-efficient saved product whose 100 g still fits
// what's left today. Only when the scanned item isn't already a great fit.
export function pickSwap(
  portion: PortionMacros,
  rem: DayRemaining,
  products: Product[],
  scannedName: string,
  scannedLevel: FitLevel
): SwapSuggestion | null {
  if (scannedLevel === "great" || scannedLevel === "none") return null;
  if (!rem.goalKcal || rem.goalKcal <= 0 || rem.kcal <= 0) return null;

  const name = scannedName.trim().toLowerCase();
  const scannedDensity = proteinDensity(portion);
  let bestDensity = scannedDensity + 0.1; // must beat scanned by ≥10 pp energy-from-protein
  let best: SwapSuggestion | null = null;

  for (const p of products) {
    if (!p || p.kcal <= 0 || p.protein <= 0) continue;
    if (p.name.trim().toLowerCase() === name) continue;
    if (p.kcal > rem.kcal) continue; // a 100 g portion should comfortably fit
    const d = (p.protein * 4) / p.kcal;
    if (d <= bestDensity) continue;
    bestDensity = d;
    best = {
      product: p,
      kcalPer100: Math.round(p.kcal),
      proteinPer100: Math.round(p.protein * 10) / 10,
    };
  }
  return best;
}
