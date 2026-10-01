import { daysBetween, daysInMonth, isIsoDate, monthLabel, monthName, monthShort, monthSlices } from "./dates.ts";
import type { BillWarning, Input, MonthResult, NextBill, Result, UpcomingBill, ValidationError } from "./types.ts";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** How far a month's billed km/day may drift from the others before it's flagged. */
export const BILL_TOLERANCE = 0.02;

export function validate(input: Input): ValidationError | null {
  const { prevDate, currDate, prevKm, currKm, rate } = input;
  if (!isIsoDate(prevDate) || !isIsoDate(currDate)) return { code: "dates" };
  if (daysBetween(prevDate, currDate) <= 0) return { code: "order" };
  if (!Number.isFinite(prevKm) || !Number.isFinite(currKm) || prevKm < 0 || currKm < 0) return { code: "km" };
  if (currKm < prevKm) return { code: "kmLower" };
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) return { code: "rate" };
  for (const s of monthSlices(prevDate, currDate)) {
    if (s.isReadingMonth) continue;
    const bill = input.bills[s.key];
    if (bill === undefined || !Number.isFinite(bill) || bill < 0) return { code: "bill", monthKey: s.key };
  }
  return null;
}

function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

/**
 * The estimate the months were billed at: median km/day of the settled months,
 * leaving out the first one when there are others. The first month's bill can
 * predate the previous reading and still use the average before it (a reading
 * on Mar 30 comes after the March bill, so March is at the older average).
 */
export function estimateKmPerDay(months: { billedKmPerDay: number }[]): number {
  return median((months.length > 1 ? months.slice(1) : months).map((m) => m.billedKmPerDay));
}

/**
 * Between two readings the estimate doesn't change, so every settled month's
 * bill implies the same km/day: bill / rate / days in month. A month that
 * drifts more than BILL_TOLERANCE from the median was probably entered in the
 * wrong month, or is the extra bill typed in as a regular bill.
 *
 * Exception: the first month of the period may be billed at the average before
 * the previous reading (see estimateKmPerDay). So the reference is the median of
 * the later months only, the first month is never flagged on its own, and at
 * least two later months are needed to say anything.
 *
 * Works on partial input too (the form calls it while the user types):
 * months without a bill are skipped.
 */
export function checkBills(input: Input): BillWarning[] {
  const { rate } = input;
  if (!Number.isFinite(rate) || rate <= 0) return [];
  const slices = monthSlices(input.prevDate, input.currDate);
  const months = slices
    .filter((s) => !s.isReadingMonth && Number.isFinite(input.bills[s.key]))
    .map((s) => ({ key: s.key, dim: s.daysInMonth, bill: input.bills[s.key], first: s === slices[0] }));
  const later = months.map((_, i) => i).filter((i) => !months[i].first);
  if (later.length < 2) return [];

  // Work on a copy of the amounts so accepted swaps count when checking the rest.
  const bills = months.map((m) => m.bill);
  const perDay = (i: number) => bills[i] / rate / months[i].dim;
  const ref = () => median(later.map(perDay));
  const off = (i: number, med: number) => Math.abs(perDay(i) - med) > BILL_TOLERANCE * med;
  const flagged = () => { const med = ref(); return months.filter((_, i) => off(i, med)).length; };

  const warnings: BillWarning[] = [];
  const swapped = new Set<number>();
  for (let i = 0; i + 1 < months.length; i++) {
    const med = ref();
    if (!off(i, med) && !off(i + 1, med)) continue;
    const before = flagged();
    [bills[i], bills[i + 1]] = [bills[i + 1], bills[i]];
    const after = ref();
    if (!off(i, after) && !off(i + 1, after) && flagged() < before) {
      const pair: [string, string] = [months[i].key, months[i + 1].key];
      warnings.push({ monthKey: pair[0], kind: "shifted", pair }, { monthKey: pair[1], kind: "shifted", pair });
      swapped.add(i).add(i + 1);
      i++;
    } else {
      [bills[i], bills[i + 1]] = [bills[i + 1], bills[i]];
    }
  }

  const med = ref();
  months.forEach((m, i) => {
    if (swapped.has(i) || !off(i, med)) return;
    if (m.first && m.bill !== input.settlement) return; // may be at the average before the previous reading
    warnings.push(m.bill === input.settlement
      ? { monthKey: m.key, kind: "settlement" }
      : { monthKey: m.key, kind: "mismatch", perDay: perDay(i), typical: med });
  });
  const order = months.map((m) => m.key);
  return warnings.sort((a, b) => order.indexOf(a.monthKey) - order.indexOf(b.monthKey));
}

/**
 * The reading month's whole bill, compared with what the old estimate would have
 * charged for it. Its first days (e.g. Sep 1–10) belong to this period.
 */
function nextBill(months: MonthResult[], rate: number, kmPerDay: number, locale: string): NextBill | null {
  const settled = months.filter((m) => m.kind === "settled");
  const reading = months.find((m) => m.kind === "new-rate");
  if (!reading || settled.length === 0) return null;
  const D = reading.daysInMonth;
  const oldKmPerDay = estimateKmPerDay(settled);
  // A real bill for a month of the same length is exactly what the old estimate charged (June 2.279 for September).
  // Not the first month: it may be at the average before the previous reading.
  const sameLength = [...(settled.length > 1 ? settled.slice(1) : settled)].reverse().find((m) => m.daysInMonth === D && m.bill !== null);
  const oldKr = sameLength ? sameLength.bill! : Math.round(oldKmPerDay * D * rate);
  const fromBill = reading.bill !== null;
  const newKmPerDay = fromBill ? reading.billedKmPerDay : kmPerDay;
  return {
    key: reading.key, label: reading.label, name: reading.name, short: monthShort(reading.key, locale), days: D,
    oldKmPerDay, oldKm: oldKr / rate, oldKr,
    newKmPerDay, newKm: newKmPerDay * D, newKr: fromBill ? reading.bill! : Math.round(newKmPerDay * D * rate),
    fromBill,
    periodDays: reading.days, periodRange: reading.rangeLabel, periodKm: reading.actualKm, periodKr: reading.portionKr,
  };
}

/**
 * From the month of the latest reading on, every monthly bill uses the new average
 * until the next reading: km/day × days in month × rate. The reading month's bill is
 * the one the user entered, if any; part of it covers the end of this period.
 */
function upcoming(input: Input, kmPerDay: number, periodKr: number, locale: string): UpcomingBill[] {
  if (!isIsoDate(input.currDate)) return [];
  let [y, m] = input.currDate.split("-").map(Number);
  const out: UpcomingBill[] = [];
  for (let i = 0; i < 3; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const days = daysInMonth(y, m);
    const entered = i === 0 ? input.bills[key] : undefined;
    const fromBill = entered !== undefined && Number.isFinite(entered);
    out.push({
      key, label: monthLabel(key, locale), name: monthName(key, locale), days,
      kr: fromBill ? entered : Math.round(kmPerDay * days * input.rate),
      fromBill, periodKr: i === 0 ? periodKr : 0,
    });
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

/**
 * The government's method:
 *  - Each month you're billed an estimate: (km/day from your last two readings) × days in month × rate.
 *  - A new reading gives the true km/day for the window. Every month billed at the old
 *    estimate is corrected: (true km/day − billed km/day) × days of that month in the window × rate.
 *  - The month of the new reading is billed after it, already at the new rate, so it isn't corrected.
 */
export function compute(input: Input, locale = "en"): Result {
  const slices = monthSlices(input.prevDate, input.currDate, locale);
  const totalDays = daysBetween(input.prevDate, input.currDate);
  const totalKm = input.currKm - input.prevKm;
  const actualKmPerDay = totalKm / totalDays;
  const rate = input.rate;

  // Calibration: the government's own average shows in the first bill at the new rate
  // (3.071 kr = 30 × 14,73 × 6,95, vs 14,76 from straight division). When that bill is
  // entered and close enough, correct the settled months with it; it reproduces their
  // settlement more closely. Too far off means the bill is probably wrong, so ignore it.
  const readingSlice = slices.find((s) => s.isReadingMonth);
  const readingBill = readingSlice ? input.bills[readingSlice.key] : undefined;
  const govKmPerDay = readingSlice && readingBill !== undefined && Number.isFinite(readingBill) && readingBill > 0
    ? readingBill / rate / readingSlice.daysInMonth
    : null;
  const calibrated = govKmPerDay !== null && Math.abs(govKmPerDay - actualKmPerDay) <= BILL_TOLERANCE * actualKmPerDay;
  const kmPerDay = calibrated ? govKmPerDay : actualKmPerDay;

  const months: MonthResult[] = slices.map((s) => {
    const actualKm = kmPerDay * s.days;
    const bill = input.bills[s.key] ?? null;

    if (s.isReadingMonth) {
      const billedKmPerDay = bill !== null ? bill / rate / s.daysInMonth : actualKmPerDay;
      const portionKr = bill !== null
        ? Math.round((bill * s.days) / s.daysInMonth)
        : Math.round(actualKm * rate);
      return {
        key: s.key, label: s.label, name: s.name, rangeLabel: s.rangeLabel, days: s.days, daysInMonth: s.daysInMonth,
        kind: "new-rate", bill, billEstimated: bill === null,
        billedKmPerDay, billedKm: billedKmPerDay * s.days, actualKm,
        gapKm: 0, gapKr: 0, gapFromBill: false, calcGapKr: 0, portionKr,
      };
    }

    const b = bill ?? 0;
    const billedKmPerDay = b / rate / s.daysInMonth;
    const billedKm = billedKmPerDay * s.days;
    const calcGapKm = r2(actualKm - billedKm);
    // The extra bill's own month line wins over our calculation (see "Month lines" in CLAUDE.md).
    const line = input.govLines?.[s.key];
    const gapFromBill = line !== undefined && Number.isFinite(line);
    const gapKm = gapFromBill ? line : calcGapKm;
    return {
      key: s.key, label: s.label, name: s.name, rangeLabel: s.rangeLabel, days: s.days, daysInMonth: s.daysInMonth,
      kind: "settled", bill: b, billEstimated: false,
      billedKmPerDay, billedKm, actualKm: gapFromBill ? billedKm + gapKm : actualKm,
      gapKm, gapKr: Math.round(gapKm * rate), gapFromBill, calcGapKr: Math.round(calcGapKm * rate),
      portionKr: Math.round((b * s.days) / s.daysInMonth),
    };
  });

  const settled = months.filter((m) => m.kind === "settled");
  const estimatesKr = settled.reduce((a, m) => a + m.portionKr, 0);
  const settlementKr = settled.reduce((a, m) => a + m.gapKr, 0);
  const calcSettlementKr = settled.reduce((a, m) => a + m.calcGapKr, 0);
  const fromBill = settled.filter((m) => m.gapFromBill).length;
  const newRateKr = months.filter((m) => m.kind === "new-rate").reduce((a, m) => a + m.portionKr, 0);
  const totalCostKr = Math.round(totalKm * rate);

  return {
    input,
    totalDays,
    totalKm,
    actualKmPerDay,
    govKmPerDay,
    averageSource: calibrated ? "new-rate bill" : "readings",
    kmPerDay,
    totalCostKr,
    months,
    estimatesKr,
    settlementKr,
    calcSettlementKr,
    linesFromBill: fromBill === 0 ? "none" : fromBill === settled.length ? "all" : "some",
    newRateKr,
    roundingKr: totalCostKr - (estimatesKr + settlementKr + newRateKr),
    upcomingBills: upcoming(input, kmPerDay, newRateKr, locale),
    nextBill: nextBill(months, rate, kmPerDay, locale),
    settlementCheck: input.settlement !== null
      ? { entered: input.settlement, diff: input.settlement - settlementKr }
      : null,
    warnings: checkBills(input),
  };
}
