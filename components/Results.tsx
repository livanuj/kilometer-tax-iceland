import Link from "next/link";
import { startOver } from "@/app/actions.ts";
import { formatDate } from "@/lib/dates.ts";
import type { Result } from "@/lib/types.ts";
import Breakdown from "./Breakdown.tsx";

const kr = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("de-DE")} kr`;
const km = (n: number) => Math.round(n).toLocaleString("de-DE");

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
  let text: string;
  if (Math.abs(s) < 50) text = "Your monthly estimates were close to what you drove, so there's little or nothing to settle.";
  else if (s > 0) text = `You drove about ${km(settledKm)} km more than your estimates covered, so expect an extra bill of about ${kr(s)}.`;
  else text = `Your estimates covered about ${km(-settledKm)} km more than you drove, so expect a refund of about ${kr(-s)}.`;

  const c = r.settlementCheck;
  return (
    <div className="verdict">
      <p>{text}</p>
      {c && (
        <p className={`check ${Math.abs(c.diff) <= 50 ? "ok" : "off"}`}>
          {Math.abs(c.diff) <= 50
            ? `Your ${c.entered < 0 ? "refund" : "extra bill"} of ${kr(Math.abs(c.entered))} matches this within ${kr(Math.abs(c.diff))}. The small difference comes from rounding.`
            : `Your ${c.entered < 0 ? "refund" : "extra bill"} of ${kr(Math.abs(c.entered))} is ${kr(Math.abs(c.diff))} away from this calculation. Check that the dates and bills match your statements.`}
        </p>
      )}
    </div>
  );
}

function PaidBar({ r }: { r: Result }) {
  const refund = r.settlementKr < 0 ? -r.settlementKr : 0;
  const segs = [
    { cls: "est", label: "Monthly estimates", value: r.estimatesKr - refund },
    ...(r.settlementKr > 0 ? [{ cls: "owe", label: "Extra bill", value: r.settlementKr }] : []),
    ...(refund > 0 ? [{ cls: "back", label: "Refunded", value: refund }] : []),
    ...(r.newRateKr > 0 ? [{ cls: "new", label: "Billed at new rate", value: r.newRateKr }] : []),
  ].filter((s) => s.value > 0);
  return (
    <section className="paid">
      <h2>How the {kr(r.totalCostKr)} gets paid</h2>
      <div className="paid-bar">
        {segs.map((s) => (
          <div key={s.cls} className={`seg ${s.cls}`} style={{ flexGrow: s.value }} title={`${s.label}: ${kr(s.value)}`}>
            <span>{kr(s.value)}</span>
          </div>
        ))}
      </div>
      <ul className="legend">
        {segs.map((s) => <li key={s.cls}><i className={s.cls} />{s.label}</li>)}
        {r.roundingKr !== 0 && <li className="rounding">{kr(r.roundingKr)} rounding</li>}
      </ul>
    </section>
  );
}

export default function Results({ result: r }: { result: Result }) {
  const { input } = r;
  return (
    <div className="results">
      <nav className="topbar">
        <span className="brand">Kilometer tax, explained</span>
        <div>
          <Link href="/?edit" className="ghost">Edit numbers</Link>
          <form action={startOver}><button className="ghost">Start over</button></form>
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
          {r.actualKmPerDay.toFixed(2).replace(".", ",")} km a day × {String(input.rate).replace(".", ",")} kr/km
          <span> = </span><strong>{kr(r.totalCostKr)}</strong> for this period
        </p>
      </section>

      <Verdict r={r} />
      <PaidBar r={r} />
      <Breakdown months={r.months} rate={input.rate} actualKmPerDay={r.actualKmPerDay} />

      <footer className="note">
        <p>
          Next month you&apos;ll be billed about {kr(r.typicalNextBillKr)} for a 30-day month, based on your new average.
          If you drive less from now on, registering a new reading 30 days or more later brings the difference back as a refund.
        </p>
        <p>
          Calculated from your numbers using the method described on Ísland.is. Your inputs are kept in a cookie on this device for 7 days and aren&apos;t stored anywhere else.
        </p>
      </footer>
    </div>
  );
}
