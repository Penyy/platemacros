import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Canonical PL value stored in DB for the default Quick entry. */
export const QUICK_ENTRY_CANONICAL = "Szybki wpis";

/** Returns the translated label when the name matches the canonical PL value. */
export function displayEntryName(
  name: string,
  t: (key: string) => string,
): string {
  return name === QUICK_ENTRY_CANONICAL ? t("quick.defaultName") : name;
}
