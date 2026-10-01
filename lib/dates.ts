// All date math is done in UTC on "YYYY-MM-DD" strings, so server and
// browser always agree no matter which time zone they run in.

export const DAY_MS = 86_400_000;

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = toUtc(s);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

export function toUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / DAY_MS);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Month and date names come from Intl in the UI language ("is", "en", "pl"); lib defaults to English.
const fmt = (locale: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...opts });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const keyUtc = (key: string, day = 1) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, day);

/** "May 2026", "Maí 2026", "Maj 2026" for a "YYYY-MM" key. */
export const monthLabel = (key: string, locale = "en") => cap(fmt(locale, { month: "long", year: "numeric" }).format(keyUtc(key)));
/** Month name for use inside a sentence: "May", "maí", "maj". */
export const monthName = (key: string, locale = "en") => fmt(locale, { month: "long" }).format(keyUtc(key));
/** Short month for chart labels: "Sep", "Sep.", "Wrz". */
export const monthShort = (key: string, locale = "en") => cap(fmt(locale, { month: "short" }).format(keyUtc(key)));
/** A day of a month: "September 29", "29. september", "29 września". */
export const dayOfMonth = (key: string, day: number, locale = "en") => fmt(locale, { day: "numeric", month: "long" }).format(keyUtc(key, day));

/** "May 20, 2026", "20. maí 2026", "20 maj 2026". */
export function formatDate(iso: string, locale = "en"): string {
  return fmt(locale, { day: "numeric", month: "short", year: "numeric" }).format(toUtc(iso));
}

/** A span of days between two UTC timestamps: "May 21 – Aug 31", "21. maí – 31. ágú.", "21–31 maj". */
export function formatSpan(from: number, to: number, locale = "en"): string {
  const f = fmt(locale, { day: "numeric", month: "short" });
  return from === to ? f.format(from) : f.formatRange(from, to);
}

export type MonthSlice = {
  key: string;            // "2026-06"
  year: number;
  month: number;          // 1–12
  label: string;          // "June 2026"
  name: string;           // "June", for use in a sentence
  rangeLabel: string;     // "Jun" or "May 21 – 31"
  daysInMonth: number;
  days: number;           // days of this month inside the window
  isReadingMonth: boolean; // month of the latest reading, billed at the new rate
};

/**
 * Splits the window into calendar months.
 * The window runs from the day AFTER the previous reading up to and including
 * the day of the latest reading (May 20 → Sep 10 = May 21–31 … Sep 1–10 = 113 days).
 */
export function monthSlices(prevIso: string, currIso: string, locale = "en"): MonthSlice[] {
  if (!isIsoDate(prevIso) || !isIsoDate(currIso)) return [];
  const start = toUtc(prevIso) + DAY_MS;
  const end = toUtc(currIso);
  if (end < start) return [];

  const endDate = new Date(end);
  const cy = endDate.getUTCFullYear();
  const cm = endDate.getUTCMonth() + 1;
  let y = new Date(start).getUTCFullYear();
  let m = new Date(start).getUTCMonth() + 1;

  const out: MonthSlice[] = [];
  while (y < cy || (y === cy && m <= cm)) {
    const monthStart = Date.UTC(y, m - 1, 1);
    const monthEnd = Date.UTC(y, m, 0);
    const ws = Math.max(monthStart, start);
    const we = Math.min(monthEnd, end);
    const days = Math.round((we - ws) / DAY_MS) + 1;
    const dim = daysInMonth(y, m);
    if (days > 0) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      out.push({
        key,
        year: y,
        month: m,
        label: monthLabel(key, locale),
        name: monthName(key, locale),
        rangeLabel: days === dim ? monthShort(key, locale) : formatSpan(ws, we, locale),
        daysInMonth: dim,
        days,
        isReadingMonth: y === cy && m === cm,
      });
    }
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}
