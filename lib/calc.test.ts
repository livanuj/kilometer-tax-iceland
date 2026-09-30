// Checks the calculation against the real bill (2,721 kr, split 289 / 792 / 820 / 820).
import { compute, validate } from "./calc.ts";
import { SAMPLE } from "./sample.ts";

const r = compute(SAMPLE);
const line = (m: { rangeLabel: string; gapKm: number; gapKr: number }) =>
  `${m.rangeLabel.padEnd(10)} ${m.gapKm.toFixed(2).padStart(8)} km ${String(m.gapKr).padStart(6)} kr`;
console.log("validate:", validate(SAMPLE) ?? "ok");
console.log(`days ${r.totalDays}, km ${r.totalKm}, ${r.actualKmPerDay.toFixed(3)} km/day, cost ${r.totalCostKr} kr`);
r.months.forEach((m) => console.log(m.kind === "settled" ? line(m) : `${m.rangeLabel.padEnd(10)} new rate, ${m.portionKr} kr`));
console.log(`estimates ${r.estimatesKr} + settlement ${r.settlementKr} + new rate ${r.newRateKr} + rounding ${r.roundingKr} = ${r.totalCostKr}`);
console.log("settlement check:", r.settlementCheck);
if (r.totalDays !== 113 || Math.abs(r.settlementCheck!.diff) > 30) { console.error("FAIL"); process.exit(1); }
console.log("PASS");
