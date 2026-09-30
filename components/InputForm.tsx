"use client";

import { useActionState, useMemo, useState } from "react";
import { loadSample, saveInputs, type FormState } from "@/app/actions.ts";
import DateField from "@/components/DateField.tsx";
import { BillsGuide, ReadingsGuide } from "@/components/Guides.tsx";
import StartOver from "@/components/StartOver.tsx";
import { checkBills } from "@/lib/calc.ts";
import { formatDate, isIsoDate, monthSlices, type MonthSlice } from "@/lib/dates.ts";
import { parseDecimal, parseRate, parseWhole } from "@/lib/parse.ts";
import { RATE_PRESETS, presetForRate } from "@/lib/rates.ts";
import type { Input } from "@/lib/types.ts";

// The bill for a month is paid near its end, which is how people find it on their statement.
const paidHint = (s: MonthSlice) => `Bill paid around ${s.label.split(" ")[0]} ${Math.min(29, s.daysInMonth)}`;

const krFmt = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("de-DE")} kr`;

const fmt = (n: number | undefined | null) => (n === undefined || n === null || !Number.isFinite(n) ? "" : String(n));

type Props = { initial: Input | null; initialError: string | null };

// "Start over" remounts the form with a new key, so typed-but-unsaved values and old errors go too.
export default function InputForm({ initial, initialError }: Props) {
  const [round, setRound] = useState(0);
  return round === 0
    ? <Form key={0} initial={initial} initialError={initialError} onReset={() => setRound(1)} />
    : <Form key={round} initial={null} initialError={null} onReset={() => setRound((r) => r + 1)} />;
}

function Form({ initial, initialError, onReset }: Props & { onReset: () => void }) {
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
  const [lines, setLines] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initial?.govLines ?? {}).map(([k, v]) => [k, String(v).replace(".", ",")])),
  );

  const slices = useMemo(() => monthSlices(prevDate, currDate), [prevDate, currDate]);
  const settled = slices.filter((s) => !s.isReadingMonth);
  const readingMonth = slices.find((s) => s.isReadingMonth);
  const presetRate = RATE_PRESETS.find((p) => p.id === preset)?.rate;
  const rate = presetRate != null ? String(presetRate) : customRate;

  // Same parsing as the Server Action, run on every keystroke so mistyped bills are flagged early.
  const warnings = useMemo(() => {
    const parsed: Record<string, number> = {};
    for (const [k, v] of Object.entries(bills)) {
      const n = parseWhole(v);
      if (Number.isFinite(n)) parsed[k] = n;
    }
    const st = parseWhole(settlement);
    return checkBills({
      prevDate, currDate, prevKm: parseWhole(prevKm), currKm: parseWhole(currKm), rate: parseRate(rate),
      bills: parsed, settlement: Number.isFinite(st) ? st : null, govLines: {},
    });
  }, [prevDate, currDate, prevKm, currKm, rate, bills, settlement]);

  // Each month line on the extra bill is km × rate, rounded per line.
  const rateNum = parseRate(rate);
  const lineKr = (key: string) => {
    const n = parseDecimal(lines[key]);
    return Number.isFinite(n) && Number.isFinite(rateNum) ? Math.round(n * rateNum) : null;
  };
  const lineKrs = settled.map((s) => lineKr(s.key));
  const linesTotal = lineKrs.every((v) => v !== null) ? lineKrs.reduce((a, v) => a! + v!, 0)! : null;
  const settlementNum = parseWhole(settlement);

  // Anything saved or typed: offer "Start over".
  const hasData = initial !== null || [prevDate, prevKm, currDate, currKm, customRate, settlement].some((v) => v.trim() !== "") ||
    [...Object.values(bills), ...Object.values(lines)].some((v) => v.trim() !== "");

  const billInput = (key: string, label: string, required: boolean, describedBy?: string) => (
    <span className="money">
      <input
        name={`bill_${key}`}
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        aria-describedby={describedBy}
        required={required}
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
        <p className="help">Find them on Ísland.is under your vehicle&apos;s odometer history.</p>
        <ReadingsGuide />
        <div className="readings">
          <fieldset>
            <legend>Previous reading</legend>
            <DateField name="prevDate" label="Date" value={prevDate} onChange={setPrevDate} before={currDate} />
            <label>Odometer<span className="unit"><input name="prevKm" inputMode="numeric" required placeholder="154.448" value={prevKm} onChange={(e) => setPrevKm(e.target.value)} /><span>km</span></span></label>
          </fieldset>
          <fieldset>
            <legend>Latest reading</legend>
            <DateField name="currDate" label="Date" value={currDate} onChange={setCurrDate} after={prevDate} />
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
        <BillsGuide />
        {slices.length === 0 ? (
          <p className="help">Enter both dates and the months to fill in will appear here.</p>
        ) : (
          <>
            <p className="help">The regular monthly bill for each month. Don&apos;t include extra bills or refunds here.</p>
            <p className="help">
              Extra bills or refunds you got shortly after your previous reading belong to the period before this one.
              Leave them out. Only the one that came after your latest reading goes in step 4.
            </p>
            <ul className="bills">
              {settled.map((s) => {
                const w = warnings.find((x) => x.monthKey === s.key);
                return (
                  <li key={s.key}>
                    <div>
                      <strong>{s.label}</strong>
                      <small>{paidHint(s)} · {s.days === s.daysInMonth ? "whole month in this period" : `${s.days} of ${s.daysInMonth} days in this period`}</small>
                    </div>
                    {billInput(s.key, `Bill for ${s.label}`, true, w ? `warn_${s.key}` : undefined)}
                    {w && <p className="warn" id={`warn_${s.key}`} role="status">{w.message}</p>}
                  </li>
                );
              })}
              {readingMonth && (
                <li className="optional">
                  <div>
                    <strong>{readingMonth.label} <em>optional</em></strong>
                    <small>{paidHint(readingMonth)}. Billed after your latest reading, so it already uses the new rate. Leave empty if it hasn&apos;t arrived.</small>
                    <small>Enter it if you have it. It makes the calculation closer to the government&apos;s.</small>
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
        <p className="help">
          This is the extra bill or refund that arrived after your latest reading{isIsoDate(currDate) ? ` (${formatDate(currDate)})` : ""}.
        </p>
        {settled.length > 0 && (
          <details className="lines" open={Object.keys(initial?.govLines ?? {}).length > 0}>
            <summary>Add the month lines from the bill</summary>
            <p className="help">
              The extra bill lists each month with its km, for example &ldquo;41,58 km&rdquo;. Enter them to use the
              government&apos;s exact figures instead of this app&apos;s calculation. Use a minus sign for a refund.
            </p>
            <ul className="bills">
              {settled.map((s, i) => (
                <li key={s.key}>
                  <div>
                    <strong>{s.label}</strong>
                    <small>{lineKrs[i] !== null ? `${krFmt(lineKrs[i]!)} on the bill` : s.rangeLabel}</small>
                  </div>
                  <span className="money">
                    <input
                      name={`line_${s.key}`}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`Km on the extra bill for ${s.label}`}
                      value={lines[s.key] ?? ""}
                      onChange={(e) => setLines((l) => ({ ...l, [s.key]: e.target.value }))}
                    />
                    <span>km</span>
                  </span>
                </li>
              ))}
            </ul>
            {linesTotal !== null && (
              <p className="help">
                These lines add up to {krFmt(linesTotal)}
                {Number.isFinite(settlementNum) && settlementNum !== linesTotal
                  ? `, not the ${krFmt(settlementNum)} you entered above. Check both against the bill.`
                  : "."}
              </p>
            )}
          </details>
        )}
      </section>

      {state.error && <p className="error" role="alert">{state.error}</p>}

      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>{pending ? "Calculating…" : "Show breakdown"}</button>
        <button type="submit" formAction={loadSample} formNoValidate className="ghost">Try with sample data</button>
        {hasData && <StartOver onConfirm={onReset} />}
      </div>
    </form>
  );
}
