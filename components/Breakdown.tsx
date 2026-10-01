"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { dec, kr, num } from "@/lib/format.ts";
import type { MonthResult, NextBill } from "@/lib/types.ts";
// Chart labels use num() (kr without the unit) to keep columns readable; the detail panel says kr.

// TOP leaves room above the tallest column for its total plus up to two segment labels.
const W = 720, BASE = 250, TOP = 64, MIN_INSIDE = 16, LINE = 15;

type Part = { cls: string; km: number; label: string };

// Settled months make up the extra bill or refund. After them, one faded "next bill" column
// compares the reading month's whole bill at the old estimate (grey) with the new average:
// amber cap when it goes up, teal when it goes down. The part of that bill that belongs
// to this period (e.g. Sep 1–10) is only mentioned in its detail panel.
export default function Breakdown({ months: all, rate, kmPerDay, warnings, next }: {
  months: MonthResult[]; rate: number; kmPerDay: number; next: NextBill | null;
  warnings: { key: string; text: string }[]; // already worded in the UI language
}) {
  const t = useTranslations("breakdown");
  const tc = useTranslations("common");
  const months = all.filter((m) => m.kind === "settled");
  const defaultIdx = Math.max(0, months.findIndex((m) => m.days === m.daysInMonth));
  const [sel, setSel] = useState(defaultIdx);
  const n = months.length + (next ? 1 : 0);
  const left = 56;
  const slot = (W - left - 8) / n;
  const barW = Math.min(64, slot * 0.56);
  const maxKm = Math.max(...months.map((m) => Math.max(m.actualKm, m.billedKm)), next ? Math.max(next.oldKm, next.newKm) : 0, 1);
  const step = [50, 100, 200, 250, 500, 1000, 2000].find((s) => maxKm / s <= 4) ?? 5000;
  const scale = (BASE - TOP) / (Math.ceil(maxKm / step) * step);
  const h = (v: number) => Math.max(0, v * scale);
  const grid = Array.from({ length: Math.ceil(maxKm / step) + 1 }, (_, i) => i * step);
  if (months.length === 0) return null; // both readings in the same month: nothing was billed by estimate
  const nextSelected = next !== null && sel === months.length;
  const m = months[Math.min(sel, months.length - 1)];
  const warning = warnings.find((w) => w.key === m.key);

  // One column: stacked parts, labels inside (or above when too short), total on top.
  const column = (i: number, key: string, parts: Part[], total: string, label: string, sub: string, aria: string,
                  opts: { next?: boolean; overlay?: ReactNode } = {}) => {
    const cx = left + slot * i + slot / 2;
    const x = cx - barW / 2;
    const isSel = i === sel;
    let y = BASE;
    const topY = BASE - parts.reduce((a, p) => a + h(p.km), 0);
    // Segments too short to hold their label get it stacked above the column instead.
    const above = parts.filter((p) => h(p.km) <= MIN_INSIDE && p.km > 0).reverse();
    return (
      <g key={key} className={`col ${isSel ? "sel" : ""} ${opts.next ? "next" : ""}`} onClick={() => setSel(i)}
         role="button" tabIndex={0} aria-pressed={isSel} aria-label={aria}
         onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(i); } }}>
        <rect x={cx - slot / 2 + 3} y={14} width={slot - 6} height={278} rx={10} className="hit" />
        {parts.map((p, j) => {
          const ph = h(p.km);
          y -= ph + (j > 0 ? 2 : 0);
          return (
            <g key={p.cls}>
              <rect x={x} y={y} width={barW} height={ph} rx={j === parts.length - 1 ? 4 : 0} className={`bar ${p.cls}`} />
              {ph > MIN_INSIDE && <text x={cx} y={y + ph / 2 + 4} textAnchor="middle" className={`in ${p.cls}`}>{p.label}</text>}
            </g>
          );
        })}
        {opts.overlay}
        {above.map((p, k) => (
          <text key={p.cls} x={cx} y={topY - 8 - k * LINE} textAnchor="middle" className={`out ${p.cls}`}>{p.label}</text>
        ))}
        <text x={cx} y={topY - 8 - above.length * LINE} textAnchor="middle" className="total">{total}</text>
        <text x={cx} y={BASE + 20} textAnchor="middle" className="mlabel">{label}</text>
        <text x={cx} y={BASE + 36} textAnchor="middle" className="mdays">{sub}</text>
      </g>
    );
  };

  const nextColumn = () => {
    if (!next) return null;
    const i = months.length;
    const cx = left + slot * i + slot / 2;
    const diffKr = next.newKr - next.oldKr;
    const up = next.newKm >= next.oldKm;
    // Grey always shows the old estimate at full height; the change sits on top (up) or over its top (down).
    const parts: Part[] = up
      ? [{ cls: "est", km: next.oldKm, label: num(next.oldKr) }, { cls: "more", km: next.newKm - next.oldKm, label: `+${num(diffKr)}` }]
      : [{ cls: "est", km: next.oldKm, label: "" }];
    const lessOverlay = !up && (() => {
      const top = BASE - h(next.oldKm), ph = h(next.oldKm - next.newKm), x = cx - barW / 2;
      return (
        <g>
          <rect x={x} y={top} width={barW} height={ph} rx={4} className="bar less" />
          <text x={cx} y={ph > MIN_INSIDE ? top + ph / 2 + 4 : top - 8 - LINE} textAnchor="middle" className={ph > MIN_INSIDE ? "in less" : "out less"}>{num(diffKr)}</text>
          {h(next.newKm) > MIN_INSIDE && <text x={cx} y={BASE - h(next.newKm) / 2 + 4} textAnchor="middle" className="in est">{num(next.oldKr)}</text>}
        </g>
      );
    })();
    const dividerX = left + slot * i;
    return (
      <>
        <line x1={dividerX} x2={dividerX} y1={20} y2={BASE + 40} className="divider" />
        {column(i, "next", parts, `${num(next.newKr)} kr`, next.short, t(next.fromBill ? "nextBill" : "nextBillEst"),
          t("nextAria", { month: next.label, amount: kr(next.newKr), old: kr(next.oldKr) }),
          { next: true, overlay: lessOverlay })}
      </>
    );
  };

  return (
    <section className="breakdown">
      <h2>{t("title")}</h2>
      <p className="help">{t("help")}</p>

      <svg viewBox={`0 0 ${W} 300`} className="chart" role="img" aria-label={t("chartLabel")}>
        {grid.map((g) => (
          <g key={g}>
            <line x1={left} x2={W - 8} y1={BASE - h(g)} y2={BASE - h(g)} className={g === 0 ? "axis" : "gridline"} />
            <text x={left - 8} y={BASE - h(g) + 4} textAnchor="end" className="tick">{g === 0 ? "0 km" : g}</text>
          </g>
        ))}
        {months.map((mo, i) => column(i, mo.key,
          mo.gapKm >= 0
            ? [{ cls: "est", km: mo.billedKm, label: num(mo.portionKr) }, { cls: "owe", km: mo.gapKm, label: `+${num(mo.gapKr)}` }]
            : [{ cls: "est", km: mo.actualKm, label: num(mo.portionKr + mo.gapKr) }, { cls: "back", km: -mo.gapKm, label: num(mo.gapKr) }],
          `${Math.round(mo.actualKm)} km`, mo.rangeLabel, tc("days", { n: mo.days }), t("colLabel", { month: mo.label, km: Math.round(mo.actualKm) })))}
        {nextColumn()}
      </svg>

      <div className="detail" aria-live="polite">
        {nextSelected && next ? <NextDetail next={next} rate={rate} t={t} /> : (
          <>
            <h3>{m.label}{m.days !== m.daysInMonth && <span> · {m.rangeLabel}</span>}</h3>
            <dl className="math">
              <dt>{t("drove")}</dt>
              <dd>
                {m.gapFromBill
                  ? <>{dec(m.billedKm, 1)} {m.gapKm >= 0 ? "+" : "−"} {dec(Math.abs(m.gapKm))} ≈ {dec(m.actualKm, 1)} km</>
                  : <>{m.days} × {dec(kmPerDay)} ≈ {dec(m.actualKm, 1)} km</>}
              </dd>
              <dt>{t("paidFor")}</dt>
              <dd>{m.days} × {dec(m.billedKmPerDay)} ≈ {dec(m.billedKm, 1)} km</dd>
              <dt className={m.gapKm >= 0 ? "owe" : "back"}>{t(m.gapKm >= 0 ? "missing" : "overpaid")}</dt>
              <dd className={m.gapKm >= 0 ? "owe" : "back"}>
                {dec(Math.abs(m.gapKm))} km × {dec(rate)} = {kr(Math.abs(m.gapKr))}
                {m.gapFromBill && <small> · {t("fromBill")}</small>}
              </dd>
            </dl>
            {warning && <p className="warn">{warning.text}</p>}
            <p className="why">
              {[
                m.gapFromBill && m.gapKr !== m.calcGapKr ? t("calcWouldBe", { amount: kr(m.calcGapKr) }) : "",
                m.days !== m.daysInMonth
                  ? t("assumedPart", { month: m.name, amount: kr(m.bill ?? 0), perDay: dec(m.billedKmPerDay), days: m.days, total: m.daysInMonth, portion: kr(m.portionKr) })
                  : t("assumed", { month: m.name, amount: kr(m.bill ?? 0), perDay: dec(m.billedKmPerDay) }),
                t(m.gapKm >= 0 ? "missingWhy" : "overpaidWhy"),
              ].filter(Boolean).join(" ")}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function NextDetail({ next, rate, t }: { next: NextBill; rate: number; t: ReturnType<typeof useTranslations<"breakdown">> }) {
  const diff = next.newKr - next.oldKr;
  const up = diff >= 0;
  const why = { old: dec(next.oldKmPerDay), new: dec(next.newKmPerDay), month: next.name, diff: kr(Math.abs(diff)), days: next.days };
  return (
    <>
      <h3>{next.label}<span> · {t(next.fromBill ? "nextHeading" : "nextHeadingEst")}</span></h3>
      <dl className="math">
        <dt>{t("oldEstimate")}</dt>
        <dd>{next.days} × {dec(next.oldKmPerDay)} ≈ {dec(next.oldKm, 1)} km = {kr(next.oldKr)}</dd>
        <dt>{t("newAverage")}</dt>
        <dd>
          {next.days} × {dec(next.newKmPerDay)} ≈ {dec(next.newKm, 1)} km = {kr(next.newKr)}
          <small> · {t(next.fromBill ? "asBilled" : "estimate")}</small>
        </dd>
        <dt className={up ? "more" : "less"}>{t(up ? "higherBy" : "lowerBy")}</dt>
        <dd className={up ? "more" : "less"}>{kr(Math.abs(diff))}</dd>
      </dl>
      <p className="why">
        {t(up ? "nextWhyUp" : "nextWhyDown", why)}{" "}
        {t("nextPeriod", { span: next.periodRange, km: Math.round(next.periodKm), amount: kr(next.periodKr), rate: dec(rate) })}
      </p>
    </>
  );
}
