// Checks the calculation against the real bill (2,721 kr, split 289 / 792 / 820 / 820).
import { checkBills, compute, validate } from "./calc.ts";
import { SAMPLE } from "./sample.ts";

const r = compute(SAMPLE);
const line = (m: { rangeLabel: string; gapKm: number; gapKr: number }) =>
  `${m.rangeLabel.padEnd(10)} ${m.gapKm.toFixed(2).padStart(8)} km ${String(m.gapKr).padStart(6)} kr`;
console.log("validate:", validate(SAMPLE) ?? "ok");
console.log(`days ${r.totalDays}, km ${r.totalKm}, ${r.actualKmPerDay.toFixed(3)} km/day, cost ${r.totalCostKr} kr`);
r.months.forEach((m) => console.log(m.kind === "settled" ? line(m) : `${m.rangeLabel.padEnd(10)} new rate, ${m.portionKr} kr`));
console.log(`estimates ${r.estimatesKr} + settlement ${r.settlementKr} + new rate ${r.newRateKr} + rounding ${r.roundingKr} = ${r.totalCostKr}`);
console.log("settlement check:", r.settlementCheck);
console.log("warnings:", r.warnings);
console.log("upcoming:", r.upcomingBills.map((b) => `${b.key} ${b.kr}${b.fromBill ? " (entered)" : ""}${b.periodKr ? `, ${b.periodKr} in period` : ""}`).join(" | "));
if (r.upcomingBills.map((b) => b.kr).join("/") !== "3071/3173/3071" || !r.upcomingBills[0].fromBill || r.upcomingBills[0].periodKr !== r.newRateKr) {
  console.error("FAIL"); process.exit(1);
}
const nb = r.nextBill!;
console.log(`next bill: ${nb.label} old ${nb.oldKr} → new ${nb.newKr} (${nb.periodKr} for ${nb.periodRange})`);
if (nb.oldKr !== 2279 || nb.newKr !== 3071 || nb.periodKr !== r.newRateKr) { console.error("FAIL"); process.exit(1); }
console.log(`average: ${r.averageSource}, ${r.kmPerDay.toFixed(3)} km/day (readings ${r.actualKmPerDay.toFixed(3)})`);
// SAMPLE has the extra bill's month lines, so every month matches the government exactly.
const lines = r.months.filter((m) => m.kind === "settled").map((m) => m.gapKr).join("/");
console.log(`month lines from bill: ${r.linesFromBill}, ${lines} kr, own calculation ${r.calcSettlementKr} kr`);
if (r.totalDays !== 113 || r.linesFromBill !== "all" || lines !== "289/792/820/820" || r.settlementCheck!.diff !== 0 ||
    r.warnings.length) { console.error("FAIL"); process.exit(1); }

// Without the month lines but with the September bill (3.071 kr), the government's average lands within 10 kr.
const r1 = compute({ ...SAMPLE, govLines: {} });
console.log(`\nwithout month lines: ${r1.averageSource}, ${r1.kmPerDay.toFixed(3)} km/day, settlement ${r1.settlementKr} kr, diff ${r1.settlementCheck!.diff} kr`);
if (r1.averageSource !== "new-rate bill" || r1.linesFromBill !== "none" || Math.abs(r1.settlementCheck!.diff) > 10 ||
    r1.calcSettlementKr !== r.calcSettlementKr) { console.error("FAIL"); process.exit(1); }

// Without the September bill either, straight division is used and the 18 kr gap is expected.
const { "2026-09": _sep, ...noSep } = SAMPLE.bills;
const r0 = compute({ ...SAMPLE, bills: noSep, govLines: {} });
console.log(`\nwithout Sep bill: ${r0.averageSource}, settlement ${r0.settlementKr} kr, diff ${r0.settlementCheck!.diff} kr`);
if (r0.averageSource !== "readings" || Math.abs(r0.settlementCheck!.diff) > 30 || r0.warnings.length) {
  console.error("FAIL"); process.exit(1);
}

// Bills shifted by a month (May/June swapped) and the extra bill typed in as August's bill.
const bad = { ...SAMPLE, govLines: {}, bills: { "2026-05": 2279, "2026-06": 2356, "2026-07": 2356, "2026-08": 2721 } };
const w = checkBills(bad);
console.log("\nbad bills:");
w.forEach((x) => console.log(`${x.monthKey} ${x.kind.padEnd(10)} ${x.message}`));
const has = (key: string, kind: string) => w.some((x) => x.monthKey === key && x.kind === kind);
if (!has("2026-05", "shifted") || !has("2026-06", "shifted") || !has("2026-08", "settlement") || w.length !== 3 ||
    validate(bad) !== null || compute(bad).warnings.length !== 3) { console.error("FAIL"); process.exit(1); }

// Same August amount without a matching extra bill: a plain mismatch.
const odd = checkBills({ ...bad, settlement: null }).find((x) => x.monthKey === "2026-08");
console.log(odd?.message);
if (odd?.kind !== "mismatch") { console.error("FAIL"); process.exit(1); }
// Real earlier period: previous reading on Mar 30 came after the March bill, so March (3.572) is still at the
// average before it, and April (3.725 = 30 × 17,87) at the new one. Both correct: no warnings.
const spring = { prevDate: "2026-03-30", prevKm: 153890, currDate: "2026-05-20", currKm: 154448, rate: 6.95,
  bills: { "2026-03": 3572, "2026-04": 3725, "2026-05": 2356 }, settlement: null, govLines: {} };
const rs = compute(spring);
console.log(`\nspring: warnings ${rs.warnings.length}, settlement ${rs.settlementKr} kr, old estimate ${rs.nextBill?.oldKr} kr`);
if (checkBills(spring).length !== 0 || rs.nextBill?.oldKr !== Math.round(3725 / 30 * 31)) { console.error("FAIL"); process.exit(1); }
console.log("PASS");
