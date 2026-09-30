import { estimateKmPerDay } from "@/lib/calc.ts";
import { DAY_MS, formatDate, toUtc } from "@/lib/dates.ts";
import type { Result } from "@/lib/types.ts";
import Link from "next/link";
import Breakdown from "./Breakdown.tsx";
import StartOver from "./StartOver.tsx";

const kr = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("de-DE")} kr`;
const km = (n: number) => Math.round(n).toLocaleString("de-DE");
const dec = (n: number) => n.toFixed(2).replace(".", ",");
const readingMonth = (r: Result) => r.months.find((m) => m.kind === "new-rate");
const monthName = (r: Result) => readingMonth(r)?.label.split(" ")[0] ?? "";
// The extra bill or refund comes with the reading month's bill, paid near its end.
const chargedOn = (r: Result) => {
  const m = readingMonth(r);
  return m ? `${m.label.slice(0, 3)} ${Math.min(29, m.daysInMonth)}` : "";
};

function Odometer({ value, date, label }: { value: number; date: string; label: string }) {
  const digits = String(Math.round(value)).padStart(6, "0").split("");
  return (
    <figure className="odo">
      <figcaption>{label}<span>{formatDate(date)}</span></figcaption>
      <div className="odo-digits" aria-label={`${km(value)} km`}>
        {digits.map((d, i) => <span key={i} aria-hidden="true">{d}</span>)}
        <em aria-hidden="true">km</em>
      </div>
    </figure>
  );
}

function Verdict({ r }: { r: Result }) {
  const s = r.settlementKr;
  const settledKm = r.months.filter((m) => m.kind === "settled").reduce((a, m) => a + m.gapKm, 0);
  const c = r.settlementCheck;
  const kind = (n: number) => (n < 0 ? "refund" : "extra bill");

  let text: string;
  if (c) {
    // They already have the bill: state both numbers instead of predicting it.
    const why = Math.abs(s) < 50 ? ""
      : s > 0 ? `You drove about ${km(settledKm)} km more than your estimates covered. `
        : `Your estimates covered about ${km(-settledKm)} km more than you drove. `;
    const calc = (c.entered < 0) === (s < 0) ? kr(Math.abs(s)) : `a ${kind(s)} of ${kr(Math.abs(s))}`;
    text = r.linesFromBill === "all"
      ? `${why}Your ${kind(c.entered)} was ${kr(Math.abs(c.entered))}.`
      : `${why}Your ${kind(c.entered)} was ${kr(Math.abs(c.entered))}. This calculation gives ${calc}.`;
  } else if (Math.abs(s) < 50) text = "Your monthly estimates were close to what you drove, so there's little or nothing to settle.";
  else if (s > 0) text = `You drove about ${km(settledKm)} km more than your estimates covered, so expect an extra bill of about ${kr(s)}.`;
  else text = `Your estimates covered about ${km(-settledKm)} km more than you drove, so expect a refund of about ${kr(-s)}.`;

  return (
    <div className="verdict">
      <p>{text}</p>
      {c && r.linesFromBill === "all" ? (
        <p className={`check ${c.diff === 0 ? "ok" : "off"}`}>
          {c.diff === 0
            ? `The months below use the lines from your bill. Worked out from the readings instead, it comes to ${kr(r.calcSettlementKr)}, ${kr(Math.abs(r.calcSettlementKr - c.entered))} off.`
            : `The month lines you entered add up to ${kr(s)}, not ${kr(c.entered)}. Check both against the bill.`}
        </p>
      ) : c ? (
        <p className={`check ${Math.abs(c.diff) <= 50 ? "ok" : "off"}`}>
          {Math.abs(c.diff) <= 50
            ? `Your ${kind(c.entered)} of ${kr(Math.abs(c.entered))} matches this within ${kr(Math.abs(c.diff))}. The small difference comes from rounding.`
            : `Your ${kind(c.entered)} of ${kr(Math.abs(c.entered))} is ${kr(Math.abs(c.diff))} away from this calculation. Check that the dates and bills match your statements.`}
        </p>
      ) : r.linesFromBill === "all" ? (
        <p className="check">The months below use the lines from your bill.</p>
      ) : (
        <p className="check">Got the extra bill already? Add it in <Link href="/edit">Edit numbers</Link> to check it.</p>
      )}
    </div>
  );
}

// "May 21" from a UTC timestamp
const shortDate = (t: number) => formatDate(new Date(t).toISOString().slice(0, 10)).replace(/, \d{4}$/, "");

// Only the months billed by estimate: what the estimates covered plus the extra bill or refund.
// The days after the latest reading are paid in that month's own bill and explained in the chart.
function PaidBar({ r }: { r: Result }) {
  const settled = r.months.filter((m) => m.kind === "settled");
  if (settled.length === 0) return null;
  const refund = r.settlementKr < 0 ? -r.settlementKr : 0;
  const estKmPerDay = estimateKmPerDay(settled);
  const costKr = Math.round(settled.reduce((a, m) => a + m.actualKm, 0) * r.input.rate);
  const roundingKr = costKr - (r.estimatesKr + r.settlementKr);
  const reading = readingMonth(r);
  const start = toUtc(r.input.prevDate) + DAY_MS;
  const end = reading ? Date.UTC(Number(reading.key.slice(0, 4)), Number(reading.key.slice(5)) - 1, 0) : toUtc(r.input.currDate);
  // The extra bill or refund is our estimate unless every month line came from the bill itself.
  const estimated = r.linesFromBill !== "all";
  const segs = [
    { cls: "est", label: "Monthly estimates", legend: `Paid via estimate (${dec(estKmPerDay)} km/day)`, value: r.estimatesKr - refund },
    ...(r.settlementKr > 0 ? [{
      cls: "owe", label: estimated ? "Estimated extra bill" : "Extra bill",
      legend: `Missing km${estimated ? " (estimate)" : ""}, charged around ${chargedOn(r)}`, value: r.settlementKr,
    }] : []),
    ...(refund > 0 ? [{
      cls: "back", label: estimated ? "Estimated refund" : "Refund",
      legend: `Overpaid km${estimated ? " (estimate)" : ""}, refunded around ${chargedOn(r)}`, value: refund,
    }] : []),
  ].filter((s) => s.value > 0);
  return (
    <section className="paid">
      <h2>
        How {shortDate(start)} – {shortDate(end)} {r.settlementCheck || r.linesFromBill === "all" ? "was" : "gets"} paid: {kr(costKr)}
      </h2>
      <div className="paid-bar">
        {segs.map((s) => (
          <div key={s.cls} className={`seg ${s.cls}`} style={{ flexGrow: s.value }} title={`${s.label}: ${kr(s.value)}`}>
            <span><b>{s.label} · </b>{kr(s.value)}</span>
          </div>
        ))}
      </div>
      <ul className="legend">
        {segs.map((s) => <li key={s.cls}><i className={s.cls} />{s.legend}</li>)}
        {roundingKr !== 0 && <li className="rounding">{kr(roundingKr)} rounding</li>}
      </ul>
      {reading && (
        <p className="help">
          That&apos;s the whole period except {reading.rangeLabel}, which is paid in your {monthName(r)} bill.
          The two together make the {kr(r.totalCostKr)} above. Select {reading.label.slice(0, 3)} in the chart to see that part.
        </p>
      )}
    </section>
  );
}

function Upcoming({ r }: { r: Result }) {
  const [first, ...rest] = r.upcomingBills;
  if (!first) return null;
  // The amount they entered if they have the bill, otherwise ours (an estimate unless the month lines are from the bill).
  const s = r.settlementCheck ? r.settlementCheck.entered : r.settlementKr;
  const est = !r.settlementCheck && r.linesFromBill !== "all" ? "estimated " : "";
  const name = (label: string) => label.split(" ")[0];
  return (
    <section className="ahead">
      <h2>Your estimated bills from now on</h2>
      <p className="help">
        Your new average, {dec(r.kmPerDay)} km a day × {dec(r.input.rate)} kr, sets each monthly bill until you register a new reading.
        These are estimates, except a bill you entered yourself.
      </p>
      <ul className="upcoming">
        <li className="first">
          <span>{name(first.label)}</span>
          <strong>{kr(first.kr)}</strong>
          <small>{first.days} days · {first.fromBill ? "as billed" : "estimate"}</small>
          {Math.abs(s) >= 1 && (
            <small className={s > 0 ? "owe" : "back"}>
              {s > 0 ? `Plus the ${est}extra bill of ${kr(s)}` : `Minus the ${est}refund of ${kr(-s)}`}
            </small>
          )}
        </li>
        {rest.map((b) => (
          <li key={b.key}>
            <span>{name(b.label)}</span>
            <strong>{kr(b.kr)}</strong>
            <small>{b.days} days · estimate</small>
          </li>
        ))}
      </ul>
      <p className="help">
        If you drive less from now on, registering a new reading 30 days or more later brings the difference back as a refund.
      </p>
    </section>
  );
}

function BillWarnings({ r }: { r: Result }) {
  if (r.warnings.length === 0) return null;
  const messages = [...new Set(r.warnings.map((w) => w.message))]; // a swap is reported on both months
  return (
    <div className="warn-banner" role="status">
      <p><strong>Some bills don&apos;t match each other, so this breakdown may be off.</strong></p>
      <ul>{messages.map((m) => <li key={m}>{m}</li>)}</ul>
      <Link href="/edit">Fix the bills</Link>
    </div>
  );
}

export default function Results({ result: r }: { result: Result }) {
  const { input } = r;
  return (
    <div className="results">
      <nav className="topbar">
        <span className="brand">Kilometer tax, explained</span>
        <div>
          <Link href="/edit" className="ghost">Edit numbers</Link>
          <StartOver standalone />
        </div>
      </nav>

      <section className="hero">
        <div className="odos">
          <Odometer value={input.prevKm} date={input.prevDate} label="Previous reading" />
          <div className="odo-gap">
            <strong>+{km(r.totalKm)} km</strong>
            <span>in {r.totalDays} days</span>
          </div>
          <Odometer value={input.currKm} date={input.currDate} label="Latest reading" />
        </div>
        <p className="equation">
          {dec(r.actualKmPerDay)} km a day × {String(input.rate).replace(".", ",")} kr/km
          <span> = </span><strong>{kr(r.totalCostKr)}</strong> for the whole period,{" "}
          {shortDate(toUtc(input.prevDate) + DAY_MS)} – {shortDate(toUtc(input.currDate))}
        </p>
        {r.averageSource === "new-rate bill" && r.govKmPerDay !== null && (
          <p className="calibrated">
            Uses the government&apos;s average of {dec(r.govKmPerDay)} km/day from your {monthName(r)} bill
            (straight division gives {dec(r.actualKmPerDay)}).
          </p>
        )}
      </section>

      <BillWarnings r={r} />
      <Verdict r={r} />
      <PaidBar r={r} />
      <Breakdown months={r.months} rate={input.rate} kmPerDay={r.kmPerDay} warnings={r.warnings} next={r.nextBill} />

      <Upcoming r={r} />

      <footer className="note">
        <p>
          Calculated from your numbers using the method described on Ísland.is. Amounts not taken from your
          bills are estimates; the government&apos;s own figures can differ by a few krónur. Your inputs are kept in a cookie on this device for 7 days and aren&apos;t stored anywhere else.
        </p>
      </footer>
    </div>
  );
}
