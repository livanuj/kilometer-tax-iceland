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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
}

export type MonthSlice = {
  key: string;            // "2026-06"
  year: number;
  month: number;          // 1–12
  label: string;          // "June 2026"
  rangeLabel: string;     // "Jun" or "May 21–31"
  daysInMonth: number;
  days: number;           // days of this month inside the window
  isReadingMonth: boolean; // month of the latest reading, billed at the new rate
};

/**
 * Splits the window into calendar months.
 * The window runs from the day AFTER the previous reading up to and including
 * the day of the latest reading (May 20 → Sep 10 = May 21–31 … Sep 1–10 = 113 days).
 */
export function monthSlices(prevIso: string, currIso: string): MonthSlice[] {
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
      const short = MONTHS[m - 1].slice(0, 3);
      const sd = new Date(ws).getUTCDate();
      const ed = new Date(we).getUTCDate();
      out.push({
        key: `${y}-${String(m).padStart(2, "0")}`,
        year: y,
        month: m,
        label: `${MONTHS[m - 1]} ${y}`,
        rangeLabel: days === dim ? short : sd === ed ? `${short} ${sd}` : `${short} ${sd}–${ed}`,
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
