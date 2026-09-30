# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Kilometer tax, explained

Handoff notes for continuing this project in Claude Code. Read this first; it explains the domain, the formula, every design decision, and what's still open.

## What this app is

A single-page Next.js app that explains Iceland's kilometer tax (*kílómetragjald*) between two odometer readings. The user enters:

1. Previous and latest odometer reading (date + km) as registered on Ísland.is
2. Their rate (kr/km), chosen from presets or typed
3. The regular monthly bill for each month between the readings (the list is generated from the dates)
4. Optionally, the extra bill or refund they received after the latest reading, which the app checks against its calculation

It then shows what they drove, what their monthly estimates covered, and where the extra bill or refund comes from, month by month.

Target: deploy on Vercel. **No separate backend** is a hard requirement from the owner.

## Domain: how the government bills

Source: island.is/kilometragjald and skatturinn.is/kilometragjald (2026 rules).

- Since Jan 1, 2026, all vehicles pay per km, billed **monthly**. The rate depends on vehicle weight: 6,95 kr/km for cars/SUVs up to 3.5 t, 4,15 kr/km for motorcycles up to 400 kg, and stepped higher rates for heavier vehicles.
- It works like a utility bill. Each month you pay an **estimate** based on your average driving between your last two registered readings.
- When you register a new reading, a new average is calculated and past months are **settled**. If you drove more than estimated, you get an extra bill. If you drove less, you get a credit (refund).
- A new reading can be registered once 30 days have passed since the last one.
- Some readings don't count toward the average (e.g. readings taken at repair shops, insurance claims, police checks).
- Vehicles with a mileage-only odometer enter miles; Skatturinn converts them.

## The formula (`lib/calc.ts`)

```
period          = day AFTER previous reading → day OF latest reading (inclusive)
totalDays       = latestDate − previousDate            (e.g. May 20 → Sep 10 = 113)
actualKmPerDay  = (latestKm − previousKm) / totalDays

for each calendar month touching the period:
  days          = days of that month inside the period
  D             = days in that month
  actualKm      = actualKmPerDay × days

  if month != month of latest reading ("settled" month):
    billedKmPerDay = bill / rate / D
    billedKm       = billedKmPerDay × days
    gapKm          = round2(actualKm − billedKm)
    gapKr          = round(gapKm × rate)          // + extra, − refund
    portionKr      = round(bill × days / D)       // share of that bill belonging to the period

  if month == month of latest reading ("new-rate" month):
    // billed AFTER the reading, already at the new average → not corrected
    portionKr = bill given ? round(bill × days / D) : round(actualKm × rate)
    gap = 0

settlementKr = Σ gapKr over settled months
totalCostKr  = round(totalKm × rate)
roundingKr   = totalCostKr − (Σ settled portionKr + settlementKr + new-rate portionKr)
```

The key insight: a month's bill is issued at month end, so the month in which a reading happens is already billed at the *new* rate. That's why the month of the latest reading is excluded from settlement, and why the first (partial) month of the period uses the bill that was issued right after the previous reading.

### Worked example (real data, used as sample + test)

Readings from Ísland.is: 2026-05-20 = 154.448 km, 2026-09-10 = 156.116 km, rate 6,95.
→ 1.668 km / 113 days = 14,761 km/day, total cost 11.593 kr.

| Month | Days in period | Bill | Billed km/day | Gap km (app) | Gap kr (app) | Gov. bill |
|---|---|---|---|---|---|---|
| May 21–31 | 11 of 31 | 2.356 | 10,94 | 42,08 | 292 | 41,58 km / 289 |
| June | 30 | 2.279 | 10,93 | 114,92 | 799 | 113,95 km / 792 |
| July | 31 | 2.356 | 10,94 | 118,60 | 824 | 117,98 km / 820 |
| August | 31 | 2.356 | 10,94 | 118,60 | 824 | 117,98 km / 820 |
| Sep 1–10 | 10 of 30 | 3.071 | new rate | — | — | not settled |

App settlement: 2.739 kr. Government settlement: 2.721 kr. Difference: 18 kr (0,7%).
Breakdown: estimates 7.827 + settlement 2.739 + new rate 1.024 + rounding 3 = 11.593 kr.

**Known discrepancy:** the government's numbers imply a new average of ≈14,73 km/day instead of 14,761 (the September bill of 3.071 kr = 30 × 14,73 × 6,95). Cause unknown; possibly time-of-day registration timestamps rather than whole days, or rounding somewhere. Don't "fix" this by hard-coding. If a better rule is found, verify it reproduces both 3.071 and 289/792/820/820.

### Earlier history (context only, not in the app)

Earlier readings and bills from the same owner, analysed before the app was built:
- April bill 3.725 kr = 30 × 17,87 km/day, where 17,87 = 929 km / 52 days from readings 2026-02-06 (152.961) → 2026-03-30 (153.890). Readings on 02-17 and 02-24 (both *Skoðun*) appear to have been ignored.
- After the 05-20 reading, April was refunded: −1.453 kr ≈ (17,87 − 10,94) × 30 × 6,95.
- A +222 kr item on 06-02 (~32 km) could not be explained from the data.

## Architecture

Next.js 15 App Router, React 19, TypeScript, plain CSS. No database, no API routes.

```
Browser                         Server (Vercel function)
───────                         ────────────────────────
InputForm (client) ──submit──▶  saveInputs (Server Action)
                                  parseForm → validate → set cookie → redirect("/")
GET / ─────────────────────────▶ page.tsx (Server Component)
                                  readInput(cookie) → compute() → render Results
◀── HTML with finished numbers
Breakdown (client) — only handles which month is selected
```

- **Storage:** httpOnly cookie `kmtax_v1`, JSON of `Input`, 7-day maxAge, `secure` in production. Well under the 4 KB cookie limit even for a year of bills.
- **Routing:** `/` shows the form if there's no valid cookie or `?edit` is present; otherwise the results.
- **Actions:** `saveInputs`, `loadSample` (writes the sample input), `startOver` (deletes the cookie).

## File map

| File | Purpose |
|---|---|
| `app/page.tsx` | Server Component. Reads cookie, validates, computes, picks form vs results. |
| `app/actions.ts` | Server Actions: save, load sample, start over. |
| `app/layout.tsx` | HTML shell, Google Fonts `<link>` (Barlow + Barlow Condensed). |
| `app/globals.css` | All styles. Design tokens as CSS variables at the top, dark mode via `prefers-color-scheme`. |
| `components/InputForm.tsx` | Client. Controlled form, generates month rows from dates, rate presets. |
| `components/Results.tsx` | Server. Odometer hero, verdict, "how it gets paid" bar, footer. |
| `components/Breakdown.tsx` | Client. SVG month chart + detail panel for the selected month. |
| `lib/calc.ts` | `validate()` and `compute()`. The only place with business logic. |
| `lib/dates.ts` | UTC date helpers and `monthSlices()` (splits the period into months). |
| `lib/parse.ts` | FormData → `Input`. Handles "154.448", "154,448", "6,95", "−1.453". |
| `lib/rates.ts` | Rate presets. |
| `lib/storage.ts` | Cookie read/write (`server-only`). |
| `lib/types.ts` | `Input`, `MonthResult`, `Result`. |
| `lib/sample.ts` | The real example above. |
| `lib/calc.test.ts` | Script test against the real bill. `npm test`. |

## Conventions and decisions (keep these)

- **All date math in UTC** on `YYYY-MM-DD` strings so the server and browser agree regardless of time zone.
- **Imports use explicit `.ts`/`.tsx` extensions** (`allowImportingTsExtensions`) so `lib/*.ts` can run directly under `node --experimental-strip-types` for the test. Keep this in `lib/`. Inside `lib/`, import with relative paths (`./dates.ts`), never the `@/` alias: Node can't resolve tsconfig paths, so an alias there breaks `npm test`. `app/` and `components/` use `@/…`.
- **Cookie schema:** `readInput()` only spot-checks a few fields before `validate()` runs. If `Input` changes shape, bump the cookie name (`kmtax_v1` → `kmtax_v2`) so old cookies are ignored instead of misread. `bills` is keyed by month as `"YYYY-MM"` (from `monthSlices()`).
- **Controlled inputs in `InputForm`.** React 19 resets uncontrolled forms after a Server Action runs, which would wipe the user's input when validation fails.
- **Number display uses `de-DE`** to get Icelandic style (dot for thousands, comma for decimals): 11.593 kr, 14,76 km/day. Km on the chart are plain integers.
- **Money is rounded per month line**, like the government's bill, then summed.
- **Rates:** there's no public API for a vehicle's weight class, so the rate isn't imported. Presets + custom input only.
- **Copy:** plain, second person, sentence case, no "please"/"successfully". Errors say what's wrong and how to fix it.
- **Design tokens** (`globals.css`): glacier-mist background, basalt ink, gravel grey = paid by estimate, signal red = you owe, moss green = refund, fjord blue = new rate. Barlow for text, Barlow Condensed for the odometer digits and headings. The odometer counters are the one bold element; keep the rest quiet.
- **Chart colour meaning is fixed:** grey estimate segment, red cap for missing km, green dashed cap for overpaid km, blue column for the new-rate month. Colours always come with a text label.

## Commands

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # prints the month table and PASS/FAIL (fails if settlement is >30 kr off the real bill)
npm run build   # verified passing: Next 15.5.26, React 19.3.0
npx tsc --noEmit  # typecheck only, faster than a build
```

There's no linter and no test framework. Tests are plain scripts that `console.log` and `process.exit(1)` on failure. Run one directly with `node --experimental-strip-types lib/<name>.test.ts` (needs Node ≥ 22.6). New test files for `lib/` should follow the same pattern; if you add more, extend the `test` script to run them all.

Deploy: import the repo on Vercel (Next.js preset). No environment variables.

## Status

Done and verified:
- Production build passes; types check.
- SSR output checked with a sample cookie: verdict, paid bar, chart labels and detail panel render with the numbers above.
- Form page renders without a cookie.

Not verified yet:
- **No visual QA in a browser.** Nobody has looked at it rendered yet. Check layout at 375 px and desktop, dark mode, and chart label overlap with many months (e.g. a 12-month period).
- Submitting the form end to end in a browser (Server Action + redirect), including the validation error path.
- Keyboard use of the chart columns (they're `role="button"` with Enter/Space).

## Open items / ideas

Edge cases to test and handle:
- Previous reading on the last day of a month (that month has 0 days in the period and is skipped; confirm this matches reality).
- Latest reading on the last day of a month: is that month's bill issued before or after the reading? Currently treated as new-rate.
- Both readings in the same month (only a new-rate slice; no settlement).
- Periods spanning a year boundary, and leap years.
- Periods shorter than 30 days (the government doesn't allow re-registering that soon; maybe show a note).
- Zero km driven (division is fine, but the copy should make sense).

Product ideas raised in the conversation:
- "What if I register today?" preview: enter today's odometer and estimate the coming extra bill or refund.
- Support more than two readings: a full history with each settlement shown in sequence, including refunds like the April example.
- Icelandic UI (`is` locale), since most users are Icelandic.
- Rate presets for 3.5–10 t vehicles once the per-km table is confirmed on island.is (only the ≥10 t table was found).
- A shareable/printable summary. Currently everything lives in the user's cookie only.
- Swap the Google Fonts `<link>` for `next/font/google` for self-hosting (the `<link>` was used only because the build sandbox had no network access to Google Fonts).

Small copy fix:
- The verdict says "expect an extra bill of about X" even when the user already entered the bill they received. Rephrase when `settlementCheck` exists.
