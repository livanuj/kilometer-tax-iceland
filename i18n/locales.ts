// Supported languages. Icelandic is the default; the choice lives in a cookie (no URL prefix).
export const LOCALES = ["is", "en", "pl"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "is";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_NAMES: Record<Locale, string> = { is: "Íslenska", en: "English", pl: "Polski" };

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);
