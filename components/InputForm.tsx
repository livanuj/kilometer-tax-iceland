"use client";

import { useActionState, useMemo, useState } from "react";
import { loadSample, saveInputs, type FormState } from "@/app/actions.ts";
import { monthSlices } from "@/lib/dates.ts";
import { RATE_PRESETS, presetForRate } from "@/lib/rates.ts";
import type { Input } from "@/lib/types.ts";

const fmt = (n: number | undefined | null) => (n === undefined || n === null || !Number.isFinite(n) ? "" : String(n));

export default function InputForm({ initial, initialError }: { initial: Input | null; initialError: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveInputs, { error: initialError });

  const [prevDate, setPrevDate] = useState(initial?.prevDate ?? "");
  const [prevKm, setPrevKm] = useState(fmt(initial?.prevKm));
  const [currDate, setCurrDate] = useState(initial?.currDate ?? "");
  const [currKm, setCurrKm] = useState(fmt(initial?.currKm));
  const [preset, setPreset] = useState(presetForRate(initial?.rate));
  const [customRate, setCustomRate] = useState(initial && presetForRate(initial.rate) === "custom" ? String(initial.rate).replace(".", ",") : "");
  const [bills, setBills] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initial?.bills ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [settlement, setSettlement] = useState(fmt(initial?.settlement));

  const slices = useMemo(() => monthSlices(prevDate, currDate), [prevDate, currDate]);
  const settled = slices.filter((s) => !s.isReadingMonth);
  const readingMonth = slices.find((s) => s.isReadingMonth);
  const presetRate = RATE_PRESETS.find((p) => p.id === preset)?.rate;
  const rate = presetRate != null ? String(presetRate) : customRate;

  const billInput = (key: string, label: string, required: boolean) => (
    <span className="money">
      <input
        name={`bill_${key}`}
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        required={required}
        placeholder="2.356"
        value={bills[key] ?? ""}
        onChange={(e) => setBills((b) => ({ ...b, [key]: e.target.value }))}
      />
      <span>kr</span>
    </span>
  );

  return (
    <form action={action} className="form" noValidate>
      <header className="intro">
        <h1>Kilometer tax, explained</h1>
        <p>
          Enter two odometer readings you registered on Ísland.is and the bills you paid in between.
          You&apos;ll see what you actually drove, what you were billed for, and where any extra bill or refund comes from.
        </p>
      </header>

      <section className="step">
        <h2><span className="stepno">1</span>Your two readings</h2>
        <p className="help">Find them on Ísland.is under your vehicle&apos;s mileage history.</p>
        <div className="readings">
          <fieldset>
            <legend>Previous reading</legend>
            <label>Date<input type="date" name="prevDate" required value={prevDate} onChange={(e) => setPrevDate(e.target.value)} /></label>
            <label>Odometer<span className="unit"><input name="prevKm" inputMode="numeric" required placeholder="154.448" value={prevKm} onChange={(e) => setPrevKm(e.target.value)} /><span>km</span></span></label>
          </fieldset>
          <fieldset>
            <legend>Latest reading</legend>
            <label>Date<input type="date" name="currDate" required value={currDate} onChange={(e) => setCurrDate(e.target.value)} /></label>
            <label>Odometer<span className="unit"><input name="currKm" inputMode="numeric" required placeholder="156.116" value={currKm} onChange={(e) => setCurrKm(e.target.value)} /><span>km</span></span></label>
          </fieldset>
        </div>
      </section>

      <section className="step">
        <h2><span className="stepno">2</span>Your rate</h2>
        <div className="presets" role="radiogroup" aria-label="Vehicle type">
          {RATE_PRESETS.map((p) => (
            <label key={p.id} className={`preset ${preset === p.id ? "on" : ""}`}>
              <input type="radio" name="ratePreset" value={p.id} checked={preset === p.id} onChange={() => setPreset(p.id)} />
              <strong>{p.rate != null ? `${String(p.rate).replace(".", ",")} kr/km` : "Enter rate"}</strong>
              <span>{p.label}</span>
            </label>
          ))}
        </div>
        {preset === "custom" && (
          <label className="custom">
            Rate from your bill
            <span className="unit"><input inputMode="decimal" placeholder="6,95" value={customRate} onChange={(e) => setCustomRate(e.target.value)} /><span>kr/km</span></span>
            <small>{RATE_PRESETS.find((p) => p.id === "custom")?.hint}</small>
          </label>
        )}
        <input type="hidden" name="rate" value={rate} />
      </section>

      <section className="step">
        <h2><span className="stepno">3</span>Bills between the readings</h2>
        {slices.length === 0 ? (
          <p className="help">Enter both dates and the months to fill in will appear here.</p>
        ) : (
          <>
            <p className="help">The regular monthly bill for each month. Don&apos;t include extra bills or refunds here.</p>
            <ul className="bills">
              {settled.map((s) => (
                <li key={s.key}>
                  <div>
                    <strong>{s.label}</strong>
                    <small>{s.days === s.daysInMonth ? "Whole month in this period" : `${s.days} of ${s.daysInMonth} days in this period`}</small>
                  </div>
                  {billInput(s.key, `Bill for ${s.label}`, true)}
                </li>
              ))}
              {readingMonth && (
                <li className="optional">
                  <div>
                    <strong>{readingMonth.label} <em>optional</em></strong>
                    <small>Billed after your latest reading, so it already uses the new rate. Leave empty if it hasn&apos;t arrived.</small>
                  </div>
                  {billInput(readingMonth.key, `Bill for ${readingMonth.label}`, false)}
                </li>
              )}
            </ul>
          </>
        )}
      </section>

      <section className="step">
        <h2><span className="stepno">4</span>Extra bill or refund <em>optional</em></h2>
        <p className="help">If you already got one after the latest reading, enter it to check it against the calculation. Use a minus sign for a refund.</p>
        <span className="money wide">
          <input name="settlement" inputMode="numeric" placeholder="2.721" value={settlement} onChange={(e) => setSettlement(e.target.value)} />
          <span>kr</span>
        </span>
      </section>

      {state.error && <p className="error" role="alert">{state.error}</p>}

      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>{pending ? "Calculating…" : "Show breakdown"}</button>
        <button type="submit" formAction={loadSample} formNoValidate className="ghost">Try with sample data</button>
      </div>
    </form>
  );
}
