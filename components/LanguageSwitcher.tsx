"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/app/actions.ts";
import { LOCALES, LOCALE_NAMES } from "@/i18n/locales.ts";

// The choice is saved in a cookie by a Server Action, which re-renders the page in the new language.
// Anything typed in the form stays.
export default function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("lang");
  const [pending, start] = useTransition();
  return (
    <nav className={`langs ${pending ? "pending" : ""}`} aria-label={t("label")}>
      {LOCALES.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={l === locale} onClick={() => start(() => setLocale(l))}>
          {LOCALE_NAMES[l]}
        </button>
      ))}
    </nav>
  );
}
