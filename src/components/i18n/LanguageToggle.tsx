"use client";

import { useI18n } from "@/components/i18n/useI18n";

export function LanguageToggle() {
  const { language, setLanguage } = useI18n();
  const next = language === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50"
      title={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      suppressHydrationWarning
    >
      {language === "ar" ? "English" : "العربية"}
    </button>
  );
}
