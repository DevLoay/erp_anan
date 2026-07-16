"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, languageDir, translateText, type ErpLanguage } from "@/lib/i18n/dictionary";

function readLanguage(): ErpLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "en" ? "en" : "ar";
}

function applyDocumentLanguage(language: ErpLanguage) {
  if (typeof document === "undefined") return;
  const dir = languageDir(language);
  document.documentElement.lang = language;
  document.documentElement.dir = dir;
  document.body.dir = dir;
}

export function setErpLanguage(language: ErpLanguage) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    window.dispatchEvent(new CustomEvent("erp-language-changed", { detail: language }));
  }
  applyDocumentLanguage(language);
}

export function useI18n() {
  const [language, setLanguageState] = useState<ErpLanguage>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const initial = readLanguage();
    setLanguageState(initial);
    applyDocumentLanguage(initial);

    const sync = () => {
      const next = readLanguage();
      setLanguageState(next);
      applyDocumentLanguage(next);
    };

    window.addEventListener("storage", sync);
    window.addEventListener("erp-language-changed", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("erp-language-changed", sync as EventListener);
    };
  }, []);

  const setLanguage = useCallback((next: ErpLanguage) => {
    setLanguageState(next);
    setErpLanguage(next);
  }, []);

  const t = useCallback((text: string) => translateText(text, language), [language]);

  return { language, dir: languageDir(language), setLanguage, t };
}
