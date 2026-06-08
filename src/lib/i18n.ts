import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import pl from "@/locales/pl.json";
import en from "@/locales/en.json";

export type AppLang = "pl" | "en";
const STORAGE_KEY = "app_language";

function detectInitialLang(): AppLang {
  if (typeof window === "undefined") return "pl";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "pl" || stored === "en") return stored;
    const nav = (window.navigator?.language ?? "").toLowerCase();
    return nav.startsWith("en") ? "en" : "pl";
  } catch {
    return "pl";
  }
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      pl: { translation: pl },
      en: { translation: en },
    },
    lng: detectInitialLang(),
    fallbackLng: "pl",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export function setAppLanguage(lng: AppLang) {
  void i18n.changeLanguage(lng);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, lng);
    } catch {
      /* ignore */
    }
  }
}

export function getAppLanguage(): AppLang {
  const cur = (i18n.language ?? "pl").slice(0, 2);
  return cur === "en" ? "en" : "pl";
}

export default i18n;
