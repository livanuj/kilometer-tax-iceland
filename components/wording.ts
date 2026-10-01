// Turns the codes that lib/ returns into sentences in the UI language. Used by the form (client)
// and the results (server), so it takes the translate function rather than calling a hook.
import { monthName } from "@/lib/dates.ts";
import { dec } from "@/lib/format.ts";
import type { BillWarning, ValidationError } from "@/lib/types.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type T = (key: any, values?: any) => string;

const monthYear = (key: string, locale: string) => `${monthName(key, locale)} ${key.slice(0, 4)}`;

/** `t` is the "warnings" namespace. */
export function warningText(t: T, w: BillWarning, locale: string): string {
  if (w.kind === "shifted" && w.pair) return t("shifted", { first: monthName(w.pair[0], locale), second: monthName(w.pair[1], locale) });
  if (w.kind === "settlement") return t("settlement", { month: monthName(w.monthKey, locale) });
  return t("mismatch", { month: monthName(w.monthKey, locale), perDay: dec(w.perDay ?? 0, 1), typical: dec(w.typical ?? 0, 1) });
}

/** `t` is the "errors" namespace. */
export function errorText(t: T, e: ValidationError, locale: string): string {
  return t(e.code, e.monthKey ? { month: monthYear(e.monthKey, locale) } : undefined);
}
