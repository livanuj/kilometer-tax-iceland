// Numbers always use Icelandic style (dot for thousands, comma for decimals) in every UI language,
// so they match the bills and Ísland.is. "de-DE" gives exactly that.
export const kr = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("de-DE")} kr`;
export const km = (n: number) => Math.round(n).toLocaleString("de-DE");
export const dec = (n: number, d = 2) => n.toFixed(d).replace(".", ",");
/** kr without the unit, for chart labels. */
export const num = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("de-DE")}`;
