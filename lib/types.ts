export type Input = {
  prevDate: string;
  prevKm: number;
  currDate: string;
  currKm: number;
  rate: number;                     // kr per km
  bills: Record<string, number>;    // monthly estimate bill per "YYYY-MM"
  settlement: number | null;        // extra bill (+) or refund (−) received after the latest reading
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
  portionKr: number;               // part of the monthly bill that belongs to the window
};

export type Result = {
  input: Input;
  totalDays: number;
  totalKm: number;
  actualKmPerDay: number;
  totalCostKr: number;
  months: MonthResult[];
  estimatesKr: number;             // settled months, portions of the estimate bills
  settlementKr: number;            // computed extra bill (+) / refund (−)
  newRateKr: number;               // portion paid (or to be paid) at the new rate
  roundingKr: number;
  typicalNextBillKr: number;       // a 30-day month at the new rate
  settlementCheck: { entered: number; diff: number } | null;
};
