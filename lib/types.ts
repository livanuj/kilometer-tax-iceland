export type Input = {
  prevDate: string;
  prevKm: number;
  currDate: string;
  currKm: number;
  rate: number;                     // kr per km
  bills: Record<string, number>;    // monthly estimate bill per "YYYY-MM"
  settlement: number | null;        // extra bill (+) or refund (−) received after the latest reading
  govLines: Record<string, number>; // optional: km per settled "YYYY-MM" as printed on the extra bill
};

export type MonthResult = {
  key: string;
  label: string;
  rangeLabel: string;
  days: number;
  daysInMonth: number;
  kind: "settled" | "new-rate";
  bill: number | null;             // full monthly bill as entered
  billEstimated: boolean;          // new-rate month with no bill entered yet
  billedKmPerDay: number;
  billedKm: number;                // km already paid for inside the window
  actualKm: number;                // km driven inside the window
  gapKm: number;                   // actual − billed, 2 decimals (0 for new-rate month)
  gapKr: number;                   // gapKm × rate, rounded
  gapFromBill: boolean;
  calcGapKr: number;               // our own calculation for this month, even when gapKr is from the bill            // gapKm taken from the extra bill's month line, not calculated
  portionKr: number;               // part of the monthly bill that belongs to the window
};

// A settled month whose bill doesn't imply the same km/day as the others.
// Warnings never block submitting; they only flag input that looks mistyped.
export type BillWarning = {
  monthKey: string;                // "YYYY-MM"
  kind: "shifted" | "settlement" | "mismatch";
  message: string;
};

export type UpcomingBill = {
  key: string;                     // "YYYY-MM"
  label: string;                   // "September 2026"
  days: number;                    // days in that month
  kr: number;                      // the whole monthly bill
  fromBill: boolean;               // the user entered this bill; otherwise estimated
  periodKr: number;                // part of it that belongs to this period (reading month only, else 0)
};

// The whole bill for the month of the latest reading: old estimate vs new average.
export type NextBill = {
  key: string;
  label: string;                   // "September 2026"
  days: number;                    // days in that month
  oldKmPerDay: number;             // the estimate before the reading (median of settled months)
  oldKm: number;
  oldKr: number;                   // what this month would have cost at the old estimate
  newKmPerDay: number;
  newKm: number;
  newKr: number;                   // the bill at the new average (entered, or estimated)
  fromBill: boolean;
  periodDays: number;              // days of this month that belong to the period (e.g. Sep 1–10)
  periodRange: string;             // "Sep 1–10"
  periodKm: number;
  periodKr: number;                // part of newKr that belongs to the period
};

export type Result = {
  input: Input;
  totalDays: number;
  totalKm: number;
  actualKmPerDay: number;          // straight division: km driven / days
  govKmPerDay: number | null;      // average implied by the new-rate month's bill, if entered
  averageSource: "readings" | "new-rate bill"; // which average the settled months were corrected with
  kmPerDay: number;                // the average actually used (govKmPerDay or actualKmPerDay)
  totalCostKr: number;             // always from the real km, so calibration shows up in roundingKr
  months: MonthResult[];
  estimatesKr: number;             // settled months, portions of the estimate bills
  settlementKr: number;            // extra bill (+) / refund (−): sum of month lines, from the bill where entered
  calcSettlementKr: number;        // same, calculated for every month, ignoring the bill's month lines
  linesFromBill: "all" | "some" | "none";
  newRateKr: number;               // portion paid (or to be paid) at the new rate
  roundingKr: number;
  upcomingBills: UpcomingBill[];
  nextBill: NextBill | null;       // null when no month was billed by estimate   // the reading month and the two after it, at the new average
  settlementCheck: { entered: number; diff: number } | null;
  warnings: BillWarning[];
};
