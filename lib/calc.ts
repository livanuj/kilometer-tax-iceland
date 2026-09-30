import { daysBetween, isIsoDate, monthSlices } from "./dates.ts";
import type { Input, MonthResult, Result } from "./types.ts";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function validate(input: Input): string | null {
  const { prevDate, currDate, prevKm, currKm, rate } = input;
  if (!isIsoDate(prevDate) || !isIsoDate(currDate)) return "Enter both reading dates.";
  if (daysBetween(prevDate, currDate) <= 0) return "The latest reading must be after the previous reading.";
  if (!Number.isFinite(prevKm) || !Number.isFinite(currKm) || prevKm < 0 || currKm < 0)
    return "Enter both odometer readings in km.";
  if (currKm < prevKm) return "The latest odometer reading is lower than the previous one. Check the numbers.";
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) return "Enter a rate in kr per km, for example 6,95.";
  for (const s of monthSlices(prevDate, currDate)) {
    if (s.isReadingMonth) continue;
    const bill = input.bills[s.key];
    if (bill === undefined || !Number.isFinite(bill) || bill < 0)
      return `Enter the monthly bill for ${s.label}.`;
  }
  return null;
}

/**
 * The government's method:
 *  - Each month you're billed an estimate: (km/day from your last two readings) × days in month × rate.
 *  - A new reading gives the true km/day for the window. Every month billed at the old
 *    estimate is corrected: (true km/day − billed km/day) × days of that month in the window × rate.
 *  - The month of the new reading is billed after it, already at the new rate, so it isn't corrected.
 */
export function compute(input: Input): Result {
  const slices = monthSlices(input.prevDate, input.currDate);
  const totalDays = daysBetween(input.prevDate, input.currDate);
  const totalKm = input.currKm - input.prevKm;
  const actualKmPerDay = totalKm / totalDays;
  const rate = input.rate;

  const months: MonthResult[] = slices.map((s) => {
    const actualKm = actualKmPerDay * s.days;
    const bill = input.bills[s.key] ?? null;

    if (s.isReadingMonth) {
      const billedKmPerDay = bill !== null ? bill / rate / s.daysInMonth : actualKmPerDay;
      const portionKr = bill !== null
        ? Math.round((bill * s.days) / s.daysInMonth)
        : Math.round(actualKm * rate);
      return {
        key: s.key, label: s.label, rangeLabel: s.rangeLabel, days: s.days, daysInMonth: s.daysInMonth,
        kind: "new-rate", bill, billEstimated: bill === null,
        billedKmPerDay, billedKm: billedKmPerDay * s.days, actualKm,
        gapKm: 0, gapKr: 0, portionKr,
      };
    }

    const b = bill ?? 0;
    const billedKmPerDay = b / rate / s.daysInMonth;
    const billedKm = billedKmPerDay * s.days;
    const gapKm = r2(actualKm - billedKm);
    return {
      key: s.key, label: s.label, rangeLabel: s.rangeLabel, days: s.days, daysInMonth: s.daysInMonth,
      kind: "settled", bill: b, billEstimated: false,
      billedKmPerDay, billedKm, actualKm,
      gapKm, gapKr: Math.round(gapKm * rate),
      portionKr: Math.round((b * s.days) / s.daysInMonth),
    };
  });

  const settled = months.filter((m) => m.kind === "settled");
  const estimatesKr = settled.reduce((a, m) => a + m.portionKr, 0);
  const settlementKr = settled.reduce((a, m) => a + m.gapKr, 0);
  const newRateKr = months.filter((m) => m.kind === "new-rate").reduce((a, m) => a + m.portionKr, 0);
  const totalCostKr = Math.round(totalKm * rate);

  return {
    input,
    totalDays,
    totalKm,
    actualKmPerDay,
    totalCostKr,
    months,
    estimatesKr,
    settlementKr,
    newRateKr,
    roundingKr: totalCostKr - (estimatesKr + settlementKr + newRateKr),
    typicalNextBillKr: Math.round(actualKmPerDay * 30 * rate),
    settlementCheck: input.settlement !== null
      ? { entered: input.settlement, diff: input.settlement - settlementKr }
      : null,
  };
}
