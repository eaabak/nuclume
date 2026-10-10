"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Language = "en" | "tr";
type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (english: string, turkish: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nuclume-language");
      if (saved === "en" || saved === "tr") updateLanguage(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === "tr"
        ? "NUCLUME — Atomdan Şehre"
        : "NUCLUME — From Atom to City";
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    updateLanguage(next);
    try {
      localStorage.setItem("nuclume-language", next);
    } catch {}
  }, []);
  const t = useCallback(
    (english: string, turkish: string) =>
      language === "tr" ? turkish : english,
    [language],
  );
  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is missing");
  return context;
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div
      className="language-switcher"
      role="group"
      aria-label={t("Language", "Dil")}
    >
      <button
        type="button"
        lang="en"
        aria-label="English"
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
      <button
        type="button"
        lang="tr"
        aria-label="Türkçe"
        aria-pressed={language === "tr"}
        onClick={() => setLanguage("tr")}
      >
        TR
      </button>
    </div>
  );
}
