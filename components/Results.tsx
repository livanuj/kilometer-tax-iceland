import Link from "next/link";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { estimateKmPerDay } from "@/lib/calc.ts";
import { DAY_MS, dayOfMonth, formatDate, formatSpan, toUtc } from "@/lib/dates.ts";
import { dec, km, kr } from "@/lib/format.ts";
import type { Result } from "@/lib/types.ts";
import Breakdown from "./Breakdown.tsx";
import StartOver from "./StartOver.tsx";
import { warningText } from "./wording.ts";

const readingMonth = (r: Result) => r.months.find((m) => m.kind === "new-rate");
// The extra bill or refund comes with the reading month's bill, paid near its end.
const chargedOn = (r: Result, locale: string) => {
  const m = readingMonth(r);
  return m ? dayOfMonth(m.key, Math.min(29, m.daysInMonth), locale) : "";
};
const editLink = (chunks: ReactNode) => <Link href="/edit">{chunks}</Link>;

// Where the method comes from. The Skatturinn article states the formula: the average per day from the
// last two readings, the monthly fee = average × days in the month, and the settlement at the next reading.
const SOURCES = [
  { key: "sourceFormula", href: "https://www.skatturinn.is/um-rsk/frettir-og-tilkynningar/kilometragjald-fyrirkomulag-og-leidrettingar" },
  { key: "sourceIsland", href: { is: "https://island.is/kilometragjald", en: "https://island.is/en/kilometer-fee" } },
  { key: "sourceRules", href: "https://www.skatturinn.is/einstaklingar/skattar-og-gjold/kilometragjald/" },
] as const;

function Odometer({ value, date, label, locale }: { value: number; date: string; label: string; locale: string }) {
  const digits = String(Math.round(value)).padStart(6, "0").split("");
  return (
    <figure className="odo">
      <figcaption>{label}<span>{formatDate(date, locale)}</span></figcaption>
      <div className="odo-digits" aria-label={`${km(value)} km`}>
        {digits.map((d, i) => <span key={i} aria-hidden="true">{d}</span>)}
        <em aria-hidden="true">km</em>
      </div>
    </figure>
  );
}

async function Verdict({ r }: { r: Result }) {
  const t = await getTranslations("verdict");
  const s = r.settlementKr;
  const settledKm = r.months.filter((m) => m.kind === "settled").reduce((a, m) => a + m.gapKm, 0);
  const c = r.settlementCheck;

  let text: string;
  if (c) {
    // They already have the bill: state both numbers instead of predicting it.
    const why = Math.abs(s) < 50 ? "" : s > 0 ? t("droveMore", { km: km(settledKm) }) : t("droveLess", { km: km(-settledKm) });
    const was = c.entered < 0 ? t("wasRefund", { amount: kr(-c.entered) }) : t("wasExtra", { amount: kr(c.entered) });
    const calc = (c.entered < 0) === (s < 0) ? t("calcGives", { amount: kr(Math.abs(s)) })
      : s < 0 ? t("calcGivesRefund", { amount: kr(-s) }) : t("calcGivesExtra", { amount: kr(s) });
    text = [why, was, r.linesFromBill === "all" ? "" : calc].filter(Boolean).join(" ");
  } else if (Math.abs(s) < 50) text = t("close");
  else if (s > 0) text = t("expectExtra", { km: km(settledKm), amount: kr(s) });
  else text = t("expectRefund", { km: km(-settledKm), amount: kr(-s) });

  const refund = c !== null && c.entered < 0;
  const amount = c ? kr(Math.abs(c.entered)) : "";
  const diff = c ? kr(Math.abs(c.diff)) : "";
  return (
    <div className="verdict">
      <p>{text}</p>
      {c && r.linesFromBill === "all" ? (
        <p className={`check ${c.diff === 0 ? "ok" : "off"}`}>
          {c.diff === 0
            ? t("linesMatch", { calc: kr(r.calcSettlementKr), diff: kr(Math.abs(r.calcSettlementKr - c.entered)) })
            : t("linesOff", { sum: kr(s), entered: kr(c.entered) })}
        </p>
      ) : c ? (
        <p className={`check ${Math.abs(c.diff) <= 50 ? "ok" : "off"}`}>
          {Math.abs(c.diff) <= 50
            ? t(refund ? "matchRefund" : "matchExtra", { amount, diff })
            : t(refund ? "offRefund" : "offExtra", { amount, diff })}
        </p>
      ) : r.linesFromBill === "all" ? (
        <p className="check">{t("fromLines")}</p>
      ) : (
        <p className="check">{t.rich("addIt", { link: editLink })}</p>
      )}
    </div>
  );
}

// Only the months billed by estimate: what the estimates covered plus the extra bill or refund.
// The days after the latest reading are paid in that month's own bill and explained in the chart.
async function PaidBar({ r, locale }: { r: Result; locale: string }) {
  const t = await getTranslations("paid");
  const settled = r.months.filter((m) => m.kind === "settled");
  if (settled.length === 0) return null;
  const refund = r.settlementKr < 0 ? -r.settlementKr : 0;
  const costKr = Math.round(settled.reduce((a, m) => a + m.actualKm, 0) * r.input.rate);
  const roundingKr = costKr - (r.estimatesKr + r.settlementKr);
  const reading = readingMonth(r);
  const start = toUtc(r.input.prevDate) + DAY_MS;
  const end = reading ? toUtc(`${reading.key}-01`) - DAY_MS : toUtc(r.input.currDate);
  const date = chargedOn(r, locale);
  // The extra bill or refund is our estimate unless every month line came from the bill itself.
  const est = r.linesFromBill !== "all";
  const segs = [
    { cls: "est", label: t("estimates"), legend: t("estimatesLegend", { perDay: dec(estimateKmPerDay(settled)) }), value: r.estimatesKr - refund },
    ...(r.settlementKr > 0 ? [{
      cls: "owe", label: t(est ? "extraEst" : "extra"), legend: t(est ? "extraLegendEst" : "extraLegend", { date }), value: r.settlementKr,
    }] : []),
    ...(refund > 0 ? [{
      cls: "back", label: t(est ? "refundEst" : "refund"), legend: t(est ? "refundLegendEst" : "refundLegend", { date }), value: refund,
    }] : []),
  ].filter((s) => s.value > 0);
  const title = { span: formatSpan(start, end, locale), amount: kr(costKr) };
  return (
    <section className="paid">
      <h2>{r.settlementCheck || r.linesFromBill === "all" ? t("titleWas", title) : t("titleGets", title)}</h2>
      <div className="paid-bar">
        {segs.map((s) => (
          <div key={s.cls} className={`seg ${s.cls}`} style={{ flexGrow: s.value }} title={`${s.label}: ${kr(s.value)}`}>
            <span><b>{s.label} · </b>{kr(s.value)}</span>
          </div>
        ))}
      </div>
      <ul className="legend">
        {segs.map((s) => <li key={s.cls}><i className={s.cls} />{s.legend}</li>)}
        {roundingKr !== 0 && <li className="rounding">{t("rounding", { amount: kr(roundingKr) })}</li>}
      </ul>
      {reading && r.nextBill && (
        <p className="help">
          {t("rest", { span: reading.rangeLabel, month: reading.name, total: kr(r.totalCostKr), short: r.nextBill.short })}
        </p>
      )}
    </section>
  );
}

async function Upcoming({ r }: { r: Result }) {
  const t = await getTranslations("upcoming");
  const [first, ...rest] = r.upcomingBills;
  if (!first) return null;
  // The amount they entered if they have the bill, otherwise ours (an estimate unless the month lines are from the bill).
  const s = r.settlementCheck ? r.settlementCheck.entered : r.settlementKr;
  const est = !r.settlementCheck && r.linesFromBill !== "all";
  return (
    <section className="ahead">
      <h2>{t("title")}</h2>
      <p className="help">{t("help", { perDay: dec(r.kmPerDay), rate: dec(r.input.rate) })}</p>
      <ul className="upcoming">
        <li className="first">
          <span>{first.label}</span>
          <strong>{kr(first.kr)}</strong>
          <small>{t(first.fromBill ? "asBilled" : "estimate", { days: first.days })}</small>
          {Math.abs(s) >= 1 && (
            <small className={s > 0 ? "owe" : "back"}>
              {s > 0 ? t(est ? "plusExtraEst" : "plusExtra", { amount: kr(s) }) : t(est ? "minusRefundEst" : "minusRefund", { amount: kr(-s) })}
            </small>
          )}
        </li>
        {rest.map((b) => (
          <li key={b.key}>
            <span>{b.label}</span>
            <strong>{kr(b.kr)}</strong>
            <small>{t("estimate", { days: b.days })}</small>
          </li>
        ))}
      </ul>
      <p className="help">{t("tip")}</p>
    </section>
  );
}

async function BillWarnings({ r, locale }: { r: Result; locale: string }) {
  if (r.warnings.length === 0) return null;
  const t = await getTranslations("warnings");
  const messages = [...new Set(r.warnings.map((w) => warningText(t, w, locale)))]; // a swap is reported on both months
  return (
    <div className="warn-banner" role="status">
      <p><strong>{t("bannerTitle")}</strong></p>
      <ul>{messages.map((m) => <li key={m}>{m}</li>)}</ul>
      <Link href="/edit">{t("fix")}</Link>
    </div>
  );
}

export default async function Results({ result: r }: { result: Result }) {
  const locale = await getLocale();
  const t = await getTranslations("results");
  const tc = await getTranslations("common");
  const tw = await getTranslations("warnings");
  const { input } = r;
  const reading = readingMonth(r);
  return (
    <div className="results">
      <nav className="topbar">
        <span className="brand">{tc("brand")}</span>
        <div>
          <Link href="/edit" className="ghost">{tc("editNumbers")}</Link>
          <StartOver standalone />
        </div>
      </nav>

      <section className="hero">
        <div className="odos">
          <Odometer value={input.prevKm} date={input.prevDate} label={t("previous")} locale={locale} />
          <div className="odo-gap">
            <strong>+{km(r.totalKm)} km</strong>
            <span>{t("inDays", { n: r.totalDays })}</span>
          </div>
          <Odometer value={input.currKm} date={input.currDate} label={t("latest")} locale={locale} />
        </div>
        <p className="equation">
          {t("perDay", { value: dec(r.actualKmPerDay) })} × {dec(input.rate)} kr/km
          <span> = </span><strong>{kr(r.totalCostKr)}</strong>{" "}
          {t("wholePeriod", { span: formatSpan(toUtc(input.prevDate) + DAY_MS, toUtc(input.currDate), locale) })}
        </p>
        {r.averageSource === "new-rate bill" && r.govKmPerDay !== null && reading && (
          <p className="calibrated">
            {t("calibrated", { gov: dec(r.govKmPerDay), month: reading.name, plain: dec(r.actualKmPerDay) })}
          </p>
        )}
      </section>

      <BillWarnings r={r} locale={locale} />
      <Verdict r={r} />
      <PaidBar r={r} locale={locale} />
      <Breakdown
        months={r.months} rate={input.rate} kmPerDay={r.kmPerDay} next={r.nextBill}
        warnings={r.warnings.map((w) => ({ key: w.monthKey, text: warningText(tw, w, locale) }))}
      />

      <Upcoming r={r} />

      <footer className="note">
        <p>{t("footer")}</p>
        <div className="sources">
          <h2>{t("sourcesTitle")}</h2>
          <ul>
            {SOURCES.map(({ key, href }) => (
              <li key={key}>
                <a href={typeof href === "string" ? href : href[locale === "is" ? "is" : "en"]} target="_blank" rel="noopener noreferrer">{t(key)}</a>
              </li>
            ))}
          </ul>
          {t("sourcesNote") && <p>{t("sourcesNote")}</p>}
        </div>
      </footer>
    </div>
  );
}
