"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DayPicker, type Matcher } from "react-day-picker";
import { enGB, is, pl } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { DAY_MS, formatDate, isIsoDate, toUtc } from "@/lib/dates.ts";

const PICKER_LOCALES = { is, en: enGB, pl };

// The picker runs in UTC like the rest of the app, so a picked day is always the same "YYYY-MM-DD".
const toDate = (iso: string) => new Date(toUtc(iso));
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * A date button that opens a calendar. Posts its value through a hidden input,
 * so the Server Action still reads `name` as "YYYY-MM-DD".
 */
export default function DateField({ name, label, value, onChange, after, before }: {
  name: string;
  label: string;
  value: string;
  onChange: (iso: string) => void;
  after?: string;   // only days after this date can be picked
  before?: string;  // only days before this date can be picked
}) {
  const locale = useLocale();
  const t = useTranslations("date");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const valid = isIsoDate(value);
  // Readings can't be in the future. "Today" is only read once the calendar is open, in the browser.
  const today = new Date(toUtc(new Date().toISOString().slice(0, 10)));
  const disabled: Matcher[] = [{ after: today }];
  if (after && isIsoDate(after)) disabled.push({ before: new Date(toUtc(after) + DAY_MS) });
  if (before && isIsoDate(before)) disabled.push({ after: new Date(toUtc(before) - DAY_MS) });
  const month = valid ? toDate(value) : after && isIsoDate(after) ? toDate(after) : before && isIsoDate(before) ? toDate(before) : today;

  return (
    <div className="datefield" ref={wrap}>
      <span id={`${id}-label`}>{label}</span>
      <button
        type="button"
        ref={button}
        className={`datebtn ${valid ? "" : "empty"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => setOpen((o) => !o)}
      >
        <span id={`${id}-value`}>{valid ? formatDate(value, locale) : t("pick")}</span>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="12.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 8.5h14M7 2.5v4M13 2.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <input type="hidden" name={name} value={value} />
      {open && (
        <div className="datepop" role="dialog" aria-label={label}>
          <DayPicker
            mode="single"
            locale={PICKER_LOCALES[locale as keyof typeof PICKER_LOCALES] ?? is}
            timeZone="UTC"
            weekStartsOn={1}
            autoFocus
            selected={valid ? toDate(value) : undefined}
            defaultMonth={month}
            endMonth={today}
            disabled={disabled}
            onSelect={(d) => {
              if (!d) return;
              onChange(toIso(d));
              setOpen(false);
              button.current?.focus();
            }}
          />
        </div>
      )}
    </div>
  );
}
