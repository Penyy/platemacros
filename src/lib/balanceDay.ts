import type { LogEntry, Product } from "@/lib/store";

// "Balance my day": given what's left (kcal + macros), search the user's saved
// products and frequently-logged foods and synthesise 1–3 item combos that fill
// the remaining macros — protein first, kcal as a ceiling. Pure arithmetic.

export interface Candidate {
  name: string;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  weight: number; // frequency / favourite score
}

export interface ComboItem {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
}

export interface Combo {
  items: ComboItem[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface BalanceTarget {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const norm = (name: string) => name.trim().toLowerCase();
const round10 = (g: number) => Math.max(10, Math.round(g / 10) * 10);
const PORTION_MAX = 350;

export function buildCandidatePool(
  products: Product[],
  entries: LogEntry[]
): Candidate[] {
  const map = new Map<string, Candidate>();
  const freq = new Map<string, number>();
  for (const e of entries) {
    const k = norm(e.name);
    if (k) freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  // Saved products carry per-100 g macros directly.
  for (const p of products) {
    if (!p || p.kcal <= 0) continue;
    const k = norm(p.name);
    if (!k || map.has(k)) continue;
    map.set(k, {
      name: p.name,
      kcal100: p.kcal,
      protein100: p.protein,
      carbs100: p.carbs,
      fat100: p.fat,
      weight: (freq.get(k) ?? 0) + 2,
    });
  }
  // Frequently logged foods: derive per-100 g from the most recent entry that
  // has a known weight.
  const repByName = new Map<string, LogEntry>();
  for (const e of entries) {
    if (!e.grams || e.grams <= 0 || e.kcal <= 0) continue;
    const k = norm(e.name);
    if (!k || map.has(k)) continue;
    const prev = repByName.get(k);
    if (!prev || e.created_at > prev.created_at) repByName.set(k, e);
  }
  for (const [k, e] of repByName) {
    if (map.has(k)) continue;
    const f = (e.grams as number) / 100;
    map.set(k, {
      name: e.name,
      kcal100: e.kcal / f,
      protein100: e.protein / f,
      carbs100: e.carbs / f,
      fat100: e.fat / f,
      weight: freq.get(k) ?? 1,
    });
  }
  return [...map.values()].sort((a, b) => b.weight - a.weight).slice(0, 16);
}

function makeItem(c: Candidate, grams: number): ComboItem {
  const f = grams / 100;
  return {
    name: c.name,
    grams,
    kcal: Math.round(c.kcal100 * f),
    protein: Math.round(c.protein100 * f),
    carbs: Math.round(c.carbs100 * f),
    fat: Math.round(c.fat100 * f),
    kcal100: c.kcal100,
    protein100: c.protein100,
    carbs100: c.carbs100,
    fat100: c.fat100,
  };
}

function totalOf(items: ComboItem[]): Combo {
  const c: Combo = { items: [...items], kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const it of items) {
    c.kcal += it.kcal;
    c.protein += it.protein;
    c.carbs += it.carbs;
    c.fat += it.fat;
  }
  return c;
}

function score(c: Combo, t: BalanceTarget, weightSum: number): number {
  let s = 0;
  const pDiff = c.protein - t.protein; // protein first: under hurts a lot
  s += pDiff < 0 ? -pDiff * 8 : pDiff * 1;
  const kDiff = c.kcal - t.kcal; // kcal ceiling: over hurts, under is mild
  s += kDiff > 0 ? kDiff * 1.2 : -kDiff * 0.35;
  s += Math.abs(c.fat - t.fat) * 2.5; // fat soft
  if (t.carbs > 0) s += Math.abs(c.carbs - t.carbs) * 0.4; // carbs soft
  s += c.items.length * 22; // prefer fewer items
  s -= Math.min(weightSum, 30) * 1.5; // prefer favourites/frequent
  return s;
}

export function balanceDay(
  target: BalanceTarget,
  pool: Candidate[],
  maxItems = 3,
  limit = 8
): Combo[] {
  if (target.kcal <= 0 || target.protein <= 0 || pool.length === 0) return [];

  const proteinSources = pool.filter((c) => c.protein100 >= 8);
  const anchors = (proteinSources.length ? proteinSources : pool).slice(0, 8);
  const raw: { combo: Combo; w: number }[] = [];

  const gramsForProtein = (c: Candidate, gP: number) => {
    if (c.protein100 <= 0) return 0;
    const capKcal = round10((target.kcal * 1.1 * 100) / Math.max(1, c.kcal100));
    return Math.max(10, Math.min(round10((gP * 100) / c.protein100), capKcal, PORTION_MAX));
  };
  const gramsForKcal = (c: Candidate, kcalLeft: number) => {
    if (c.kcal100 <= 0 || kcalLeft <= 0) return 0;
    return Math.max(10, Math.min(round10((kcalLeft * 100) / c.kcal100), PORTION_MAX));
  };

  for (const A of anchors) {
    const itemA = makeItem(A, gramsForProtein(A, target.protein));
    raw.push({ combo: totalOf([itemA]), w: A.weight });
    const leftKcal1 = target.kcal - itemA.kcal;
    if (leftKcal1 < 40) continue;

    for (const B of pool) {
      if (norm(B.name) === norm(A.name)) continue;
      const gB = gramsForKcal(B, leftKcal1);
      if (gB <= 0) continue;
      const itemB = makeItem(B, gB);
      raw.push({ combo: totalOf([itemA, itemB]), w: A.weight + B.weight });
      if (maxItems < 3) continue;

      const leftKcal2 = leftKcal1 - itemB.kcal;
      const leftFat2 = target.fat - itemA.fat - itemB.fat;
      if (leftKcal2 < 60 && leftFat2 < 4) continue;
      for (const C of pool) {
        const nC = norm(C.name);
        if (nC === norm(A.name) || nC === norm(B.name)) continue;
        const gC = gramsForKcal(C, Math.max(leftKcal2, 1));
        if (gC <= 0) continue;
        const itemC = makeItem(C, gC);
        raw.push({ combo: totalOf([itemA, itemB, itemC]), w: A.weight + B.weight + C.weight });
      }
    }
  }

  const seen = new Set<string>();
  const out: Combo[] = [];
  for (const { combo, w } of raw
    .map((r) => ({ ...r, s: score(r.combo, target, r.w) }))
    .sort((a, b) => a.s - b.s)) {
    if (combo.kcal > target.kcal * 1.15) continue;
    if (combo.protein < target.protein * 0.7) continue;
    const key = combo.items
      .map((i) => norm(i.name))
      .sort()
      .join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(combo);
    if (out.length >= limit) break;
  }
  return out;
}

export type ComboStatus = "good" | "kcal_slack" | "fat_low" | "fat_high";

export function comboStatus(c: Combo, t: BalanceTarget): ComboStatus {
  const fatDiff = c.fat - t.fat;
  if (fatDiff < -4) return "fat_low";
  if (fatDiff > 5) return "fat_high";
  if (t.kcal - c.kcal > 60) return "kcal_slack";
  return "good";
}
