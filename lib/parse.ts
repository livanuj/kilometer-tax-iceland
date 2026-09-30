import type { Input } from "./types.ts";

// Accepts Icelandic and English number styles: "154.448", "154,448", "154 448".
export function parseWhole(v: FormDataEntryValue | string | null | undefined): number {
  const s = String(v ?? "").trim().replace(/[−–]/g, "-").replace(/kr\.?$/i, "").replace(/[\s.,]/g, "");
  if (s === "" || s === "-") return NaN;
  return Number(s);
}

// Rates use a decimal comma in Iceland: "6,95".
export function parseRate(v: FormDataEntryValue | string | null | undefined): number {
  const s = String(v ?? "").trim().replace(/\s/g, "").replace(",", ".");
  return s === "" ? NaN : Number(s);
}

export function parseForm(fd: FormData): Input {
  const bills: Record<string, number> = {};
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("bill_")) continue;
    const n = parseWhole(v);
    if (Number.isFinite(n)) bills[k.slice(5)] = n;
  }
  const settlement = parseWhole(fd.get("settlement"));
  return {
    prevDate: String(fd.get("prevDate") ?? ""),
    prevKm: parseWhole(fd.get("prevKm")),
    currDate: String(fd.get("currDate") ?? ""),
    currKm: parseWhole(fd.get("currKm")),
    rate: parseRate(fd.get("rate")),
    bills,
    settlement: Number.isFinite(settlement) ? settlement : null,
  };
}
