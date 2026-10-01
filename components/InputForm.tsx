"use client";

import { useActionState, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { loadSample, saveInputs, type FormState } from "@/app/actions.ts";
import DateField from "@/components/DateField.tsx";
import { BillsGuide, ReadingsGuide } from "@/components/Guides.tsx";
import StartOver from "@/components/StartOver.tsx";
import { errorText, warningText } from "@/components/wording.ts";
import { checkBills } from "@/lib/calc.ts";
import { dayOfMonth, formatDate, isIsoDate, monthSlices } from "@/lib/dates.ts";
import { kr as krFmt } from "@/lib/format.ts";
import { parseDecimal, parseRate, parseWhole } from "@/lib/parse.ts";
import { RATE_PRESETS, presetForRate } from "@/lib/rates.ts";
import type { Input, ValidationError } from "@/lib/types.ts";

const fmt = (n: number | undefined | null) => (n === undefined || n === null || !Number.isFinite(n) ? "" : String(n));

type Props = { initial: Input | null; initialError: ValidationError | null };

// "Start over" remounts the form with a new key, so typed-but-unsaved values and old errors go too.
export default function InputForm({ initial, initialError }: Props) {
  const [round, setRound] = useState(0);
  return round === 0
    ? <Form key={0} initial={initial} initialError={initialError} onReset={() => setRound(1)} />
    : <Form key={round} initial={null} initialError={null} onReset={() => setRound((r) => r + 1)} />;
}

function Form({ initial, initialError, onReset }: Props & { onReset: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveInputs, { error: initialError });
  const locale = useLocale();
  const t = useTranslations("form");
  const tc = useTranslations("common");
  const tr = useTranslations("rates");
  const tw = useTranslations("warnings");
  const te = useTranslations("errors");
  // The bill for a month is paid near its end, which is how people find it on their statement.
  const paidHint = (s: { key: string; daysInMonth: number }) => t("paidAround", { date: dayOfMonth(s.key, Math.min(29, s.daysInMonth), locale) });

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

  const slices = useMemo(() => monthSlices(prevDate, currDate, locale), [prevDate, currDate, locale]);
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
        <h1>{tc("brand")}</h1>
        <p>{t("intro")}</p>
      </header>

      <section className="step">
        <h2><span className="stepno">1</span>{t("step1")}</h2>
        <p className="help">{t("step1Help")}</p>
        <ReadingsGuide />
        <div className="readings">
          <fieldset>
            <legend>{t("previous")}</legend>
            <DateField name="prevDate" label={t("date")} value={prevDate} onChange={setPrevDate} before={currDate} />
            <label>{t("odometer")}<span className="unit"><input name="prevKm" inputMode="numeric" required placeholder="154.448" value={prevKm} onChange={(e) => setPrevKm(e.target.value)} /><span>km</span></span></label>
          </fieldset>
          <fieldset>
            <legend>{t("latest")}</legend>
            <DateField name="currDate" label={t("date")} value={currDate} onChange={setCurrDate} after={prevDate} />
            <label>{t("odometer")}<span className="unit"><input name="currKm" inputMode="numeric" required placeholder="156.116" value={currKm} onChange={(e) => setCurrKm(e.target.value)} /><span>km</span></span></label>
          </fieldset>
        </div>
      </section>

      <section className="step">
        <h2><span className="stepno">2</span>{t("step2")}</h2>
        <div className="presets" role="radiogroup" aria-label={tr("vehicleType")}>
          {RATE_PRESETS.map((p) => (
            <label key={p.id} className={`preset ${preset === p.id ? "on" : ""}`}>
              <input type="radio" name="ratePreset" value={p.id} checked={preset === p.id} onChange={() => setPreset(p.id)} />
              <strong>{p.rate != null ? `${String(p.rate).replace(".", ",")} kr/km` : tr("enter")}</strong>
              <span>{tr(p.id)}</span>
            </label>
          ))}
        </div>
        {preset === "custom" && (
          <label className="custom">
            {tr("fromBill")}
            <span className="unit"><input inputMode="decimal" placeholder="6,95" value={customRate} onChange={(e) => setCustomRate(e.target.value)} /><span>kr/km</span></span>
            <small>{tr("customHint")}</small>
          </label>
        )}
        <input type="hidden" name="rate" value={rate} />
      </section>

      <section className="step">
        <h2><span className="stepno">3</span>{t("step3")}</h2>
        <BillsGuide />
        {slices.length === 0 ? (
          <p className="help">{t("noMonths")}</p>
        ) : (
          <>
            <p className="help">{t("billsHelp")}</p>
            <p className="help">{t("billsHelpEarlier")}</p>
            <ul className="bills">
              {settled.map((s) => {
                const w = warnings.find((x) => x.monthKey === s.key);
                return (
                  <li key={s.key}>
                    <div>
                      <strong>{s.label}</strong>
                      <small>{paidHint(s)} · {s.days === s.daysInMonth ? t("wholeMonth") : t("partMonth", { days: s.days, total: s.daysInMonth })}</small>
                    </div>
                    {billInput(s.key, t("billFor", { month: s.label }), true, w ? `warn_${s.key}` : undefined)}
                    {w && <p className="warn" id={`warn_${s.key}`} role="status">{warningText(tw, w, locale)}</p>}
                  </li>
                );
              })}
              {readingMonth && (
                <li className="optional">
                  <div>
                    <strong>{readingMonth.label} <em>{t("optional")}</em></strong>
                    <small>{paidHint(readingMonth)}. {t("readingMonthHelp")}</small>
                    <small>{t("readingMonthWhy")}</small>
                  </div>
                  {billInput(readingMonth.key, t("billFor", { month: readingMonth.label }), false)}
                </li>
              )}
            </ul>
          </>
        )}
      </section>

      <section className="step">
        <h2><span className="stepno">4</span>{t("step4")} <em>{t("optional")}</em></h2>
        <p className="help">{t("step4Help")}</p>
        <span className="money wide">
          <input name="settlement" inputMode="numeric" placeholder="2.721" value={settlement} onChange={(e) => setSettlement(e.target.value)} />
          <span>kr</span>
        </span>
        <p className="help">
          {isIsoDate(currDate) ? t("step4WhichDate", { date: formatDate(currDate, locale) }) : t("step4Which")}
        </p>
        {settled.length > 0 && (
          <details className="lines" open={Object.keys(initial?.govLines ?? {}).length > 0}>
            <summary>{t("linesSummary")}</summary>
            <p className="help">{t("linesHelp")}</p>
            <ul className="bills">
              {settled.map((s, i) => (
                <li key={s.key}>
                  <div>
                    <strong>{s.label}</strong>
                    <small>{lineKrs[i] !== null ? t("lineOnBill", { amount: krFmt(lineKrs[i]!) }) : s.rangeLabel}</small>
                  </div>
                  <span className="money">
                    <input
                      name={`line_${s.key}`}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={t("lineLabel", { month: s.label })}
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
                {Number.isFinite(settlementNum) && settlementNum !== linesTotal
                  ? t("linesTotalOff", { total: krFmt(linesTotal), entered: krFmt(settlementNum) })
                  : t("linesTotal", { total: krFmt(linesTotal) })}
              </p>
            )}
          </details>
        )}
      </section>

      {state.error && <p className="error" role="alert">{errorText(te, state.error, locale)}</p>}

      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>{pending ? t("submitting") : t("submit")}</button>
        <button type="submit" formAction={loadSample} formNoValidate className="ghost">{t("sample")}</button>
        {hasData && <StartOver onConfirm={onReset} />}
      </div>
    </form>
  );
}
