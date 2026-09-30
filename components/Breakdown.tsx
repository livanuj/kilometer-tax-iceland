"use client";

import { useState } from "react";
import type { MonthResult } from "@/lib/types.ts";

const kr = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("de-DE")} kr`;
const dec = (n: number, d = 2) => n.toFixed(d).replace(".", ",");

const W = 720, BASE = 250, TOP = 40;

export default function Breakdown({ months, rate, actualKmPerDay }: { months: MonthResult[]; rate: number; actualKmPerDay: number }) {
  const defaultIdx = Math.max(0, months.findIndex((m) => m.kind === "settled" && m.days === m.daysInMonth));
  const [sel, setSel] = useState(defaultIdx);
  const n = months.length;
  const left = 56;
  const slot = (W - left - 8) / n;
  const barW = Math.min(64, slot * 0.56);
  const maxKm = Math.max(...months.map((m) => Math.max(m.actualKm, m.billedKm)), 1);
  const step = [50, 100, 200, 250, 500, 1000, 2000].find((s) => maxKm / s <= 4) ?? 5000;
  const scale = (BASE - TOP) / (Math.ceil(maxKm / step) * step);
  const h = (v: number) => Math.max(0, v * scale);
  const grid = Array.from({ length: Math.ceil(maxKm / step) + 1 }, (_, i) => i * step);
  const m = months[sel];

  return (
    <section className="breakdown">
      <h2>Month by month</h2>
      <p className="help">Each column is the km driven in that part of the period. Select a month to see the math.</p>

      <svg viewBox={`0 0 ${W} 300`} className="chart" role="img" aria-label="Km per month: paid by estimate, and the difference charged or refunded">
        {grid.map((g) => (
          <g key={g}>
            <line x1={left} x2={W - 8} y1={BASE - h(g)} y2={BASE - h(g)} className={g === 0 ? "axis" : "gridline"} />
            <text x={left - 8} y={BASE - h(g) + 4} textAnchor="end" className="tick">{g === 0 ? "0 km" : g}</text>
          </g>
        ))}
        {months.map((mo, i) => {
          const cx = left + slot * i + slot / 2;
          const x = cx - barW / 2;
          const isSel = i === sel;
          const parts: { cls: string; km: number; label: string }[] =
            mo.kind === "new-rate"
              ? [{ cls: "new", km: mo.actualKm, label: kr(mo.portionKr) }]
              : mo.gapKm >= 0
                ? [{ cls: "est", km: mo.billedKm, label: kr(mo.portionKr) }, { cls: "owe", km: mo.gapKm, label: `+${kr(mo.gapKr)}` }]
                : [{ cls: "est", km: mo.actualKm, label: kr(mo.portionKr + mo.gapKr) }, { cls: "back", km: -mo.gapKm, label: kr(mo.gapKr) }];
          let y = BASE;
          const topY = BASE - parts.reduce((a, p) => a + h(p.km), 0);
          return (
            <g key={mo.key} className={`col ${isSel ? "sel" : ""}`} onClick={() => setSel(i)}
               role="button" tabIndex={0} aria-pressed={isSel} aria-label={`${mo.label}: ${Math.round(mo.actualKm)} km`}
               onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(i); } }}>
              <rect x={cx - slot / 2 + 3} y={14} width={slot - 6} height={278} rx={10} className="hit" />
              {parts.map((p, j) => {
                const ph = h(p.km);
                y -= ph + (j > 0 ? 2 : 0);
                return (
                  <g key={p.cls}>
                    <rect x={x} y={y} width={barW} height={ph} rx={j === parts.length - 1 ? 4 : 0} className={`bar ${p.cls}`} />
                    {ph > 16 && <text x={cx} y={y + ph / 2 + 4} textAnchor="middle" className={`in ${p.cls}`}>{p.label}</text>}
                  </g>
                );
              })}
              <text x={cx} y={topY - 8} textAnchor="middle" className="total">{Math.round(mo.actualKm)} km</text>
              <text x={cx} y={BASE + 20} textAnchor="middle" className="mlabel">{mo.rangeLabel}</text>
              <text x={cx} y={BASE + 36} textAnchor="middle" className="mdays">{mo.days} days</text>
            </g>
          );
        })}
      </svg>

      <div className="detail" aria-live="polite">
        <h3>{m.label}{m.days !== m.daysInMonth && <span> · {m.rangeLabel}</span>}</h3>
        {m.kind === "settled" ? (
          <>
            <dl className="math">
              <dt>Actually drove</dt>
              <dd>{m.days} days × {dec(actualKmPerDay)} km/day = {dec(m.actualKm, 1)} km</dd>
              <dt>Already paid for</dt>
              <dd>{m.days} days × {dec(m.billedKmPerDay)} km/day = {dec(m.billedKm, 1)} km</dd>
              <dt className={m.gapKm >= 0 ? "owe" : "back"}>{m.gapKm >= 0 ? "Missing" : "Overpaid"}</dt>
              <dd className={m.gapKm >= 0 ? "owe" : "back"}>{dec(Math.abs(m.gapKm))} km × {dec(rate)} kr = {kr(Math.abs(m.gapKr))}</dd>
            </dl>
            <p className="why">
              Your {m.label} bill of {kr(m.bill ?? 0)} assumed {dec(m.billedKmPerDay)} km a day
              {m.days !== m.daysInMonth && <>; {m.days} of its {m.daysInMonth} days belong to this period, about {kr(m.portionKr)}</>}.
              {" "}{m.gapKm >= 0 ? "The missing km are added to your extra bill." : "The overpaid km come back as a refund."}
            </p>
          </>
        ) : (
          <>
            <dl className="math">
              <dt>Billed at new rate</dt>
              <dd>{m.days} days × {dec(m.billedKmPerDay)} km/day × {dec(rate)} kr = {kr(m.portionKr)}</dd>
            </dl>
            <p className="why">
              {m.billEstimated
                ? "This month is billed after your latest reading, so it will use your new average. Nothing here needs correcting."
                : `Your ${m.label} bill of ${kr(m.bill ?? 0)} was issued after your latest reading and already uses the new average, so nothing here needs correcting.`}
              {" "}It will be checked again at your next reading.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
