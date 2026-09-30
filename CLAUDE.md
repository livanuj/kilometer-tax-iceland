# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Kilometer tax, explained

Handoff notes for continuing this project in Claude Code. Read this first; it explains the domain, the formula, every design decision, and what's still open.

## What this app is

A single-page Next.js app that explains Iceland's kilometer tax (*kílómetragjald*) between two odometer readings. The user enters:

1. Previous and latest odometer reading (date + km) as registered on Ísland.is
2. Their rate (kr/km), chosen from presets or typed
3. The regular monthly bill for each month between the readings (the list is generated from the dates)
4. Optionally, the extra bill or refund they received after the latest reading, which the app checks against its calculation, and optionally that bill's per-month lines (km), which then replace the app's calculation month by month

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

govKmPerDay     = new-rate month's bill / rate / its daysInMonth   (only if that bill is entered)
kmPerDay        = govKmPerDay if within 2% of actualKmPerDay, else actualKmPerDay   ("calibration", see below)

for each calendar month touching the period:
  days          = days of that month inside the period
  D             = days in that month
  actualKm      = kmPerDay × days        (settled months; new-rate month uses actualKmPerDay)

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
totalCostKr  = round(totalKm × rate)          // always real km, never calibrated
roundingKr   = totalCostKr − (Σ settled portionKr + settlementKr + new-rate portionKr)
```

The key insight: a month's bill is issued at month end, so the month in which a reading happens is already billed at the *new* rate. That's why the month of the latest reading is excluded from settlement, and why the first (partial) month of the period uses the bill that was issued right after the previous reading.

### Bill consistency check (`checkBills()`)

Between two readings the estimate doesn't change, so every settled month's bill implies the **same km/day**: `bill / rate / daysInMonth` (≈10,94 in the sample; 31-day months have the bigger bill). `checkBills()` uses this to catch mistyped input:

- **The first month of the period is the exception.** Its bill can be issued before the previous reading and still use the average from before it. Real case: the Mar 30 reading came after the March bill, so March is 3.572 kr (16,58 km/day) while April is 3.725 kr (17,87). So the reference is the median of the **later** months only, the first month is never flagged on its own (only a "settlement" match or as half of a swap), and the check needs at least 2 later months. Before this, the two-month Mar/Apr case falsely showed "swapped". The same rule is in `estimateKmPerDay()`, used for the next-bill column's old estimate and the paid-bar legend.
- Flags any month more than 2% (`BILL_TOLERANCE`) away from that median.
- For flagged months, tries swapping neighbouring amounts. If both then match (and fewer months are flagged overall), it's a `"shifted"` warning, emitted on **both** months with the same message.
- A remaining flagged month whose bill equals `input.settlement` gets a `"settlement"` warning (extra bill typed in as a monthly bill); anything else gets `"mismatch"`.
- These are warnings only: they never block submitting and aren't part of `validate()`. `compute()` puts them in `Result.warnings`; the form runs `checkBills()` live on the parsed state; Results shows a banner (messages de-duplicated) and Breakdown shows the month's warning in its detail panel.

Bad-data case in the test: bills May 2.279, Jun 2.356, Jul 2.356, Aug 2.721 (settlement 2.721) → "shifted" on May + June, "settlement" on August.

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

The table above uses straight division (14,761 km/day), i.e. **without** the September bill.
App settlement: 2.739 kr. Government settlement: 2.721 kr. Difference: 18 kr (0,7%).
Breakdown: estimates 7.827 + settlement 2.739 + new rate 1.024 + rounding 3 = 11.593 kr.

### Calibration from the new-rate bill

The government's numbers imply a new average of ≈14,73 km/day, not 14,761: the September bill of 3.071 kr = 30 × 14,729 × 6,95. Cause still unknown (possibly time-of-day registration timestamps rather than whole days, or rounding somewhere), so instead of guessing a rule, `compute()` reads the government's average back out of the new-rate month's bill when the user enters it:

- `govKmPerDay = bill / rate / daysInMonth` for the month of the latest reading.
- Used for the settled months' `actualKm` and `gapKm` only when within 2% (`BILL_TOLERANCE`) of `actualKmPerDay`; a bigger gap means the bill is probably wrong, so it's ignored.
- `Result.averageSource` is `"new-rate bill"` or `"readings"`; `Result.kmPerDay` is the one used; `govKmPerDay` is `null` without a bill.
- `totalCostKr` stays on the real km, so the calibration difference lands in `roundingKr`. The legend then says "rounding and average difference". Results shows a note: "Uses the government's average of 14,73 km/day from your September bill (straight division gives 14,76)."

With the sample's Sep bill but without its month lines: gaps 290 / 792 / 817 / 817 kr, settlement 2.716 kr, **5 kr** from the real 2.721 (gov. 289 / 792 / 820 / 820). Breakdown: estimates 7.827 + settlement 2.716 + new rate 1.024 + rounding and average 26 = 11.593 kr.

### Month lines from the extra bill (`Input.govLines`)

The extra bill lists each settled month with its km (e.g. "41,58 km / 289 kr"). No rule found so far reproduces those lines: they imply 14,729 km/day for June but 14,741 for July, so the government isn't applying one daily average to bill-derived km. The owner's call: **let users type the lines in** rather than approximate them.

- Step 4 has a collapsible "Add the month lines from the bill" list, one km field per settled month (`line_YYYY-MM`, parsed by `parseDecimal()`: "41,58", "113.95", "1.234,56"). It shows each line's kr and the total, and flags a total that differs from the extra bill entered above.
- In `compute()`, a month with a line uses it: `gapKm = line`, `gapKr = round(line × rate)`, `gapFromBill = true`, and `actualKm = billedKm + gapKm` so the column height matches the bill. `calcGapKr` always holds the app's own number; `Result.calcSettlementKr` sums those. `Result.linesFromBill` is `"all" | "some" | "none"`.
- `totalCostKr` stays on the real km, so the difference lands in `roundingKr` (21 kr for the sample, labelled "rounding and average difference").
- With all lines entered the verdict states the bill and compares it with the app's own calculation ("…comes to 2.716 kr, 5 kr off"); the detail panel marks the line "from your bill".
- `SAMPLE` includes the real lines (41,58 / 113,95 / 117,98 / 117,98), so "Try with sample data" shows the government's 289 / 792 / 820 / 820 and a 2.721 kr extra bill.
- `govLines` was added after launch: `readInput()` defaults it to `{}` for older cookies, so the cookie name wasn't bumped.

If a real rule for the 14,73 is found, verify it reproduces both 3.071 and 289/792/820/820 without the September bill, then calibration can go.

### Earlier history (context only, not in the app)

Earlier readings and bills from the same owner, analysed before the app was built:
- April bill 3.725 kr = 30 × 17,87 km/day, where 17,87 = 929 km / 52 days from readings 2026-02-06 (152.961) → 2026-03-30 (153.890). Readings on 02-17 and 02-24 (both *Skoðun*) appear to have been ignored.
- After the 05-20 reading, April was refunded: −1.453 kr ≈ (17,87 − 10,94) × 30 × 6,95.
- A +222 kr item on 06-02 (~32 km) could not be explained from the data.

## Architecture

Next.js 15 App Router, React 19, TypeScript, plain CSS. No database, no API routes. The only UI dependency is `react-day-picker` (the date fields).

```
Browser                         Server (Vercel function)
───────                         ────────────────────────
InputForm (client) ──submit──▶  saveInputs (Server Action)
                                  parseForm → validate → set cookie → redirect("/result")
GET /result ───────────────────▶ result/page.tsx (Server Component)
                                  readInput(cookie) → compute() → render Results
◀── HTML with finished numbers
Breakdown (client) — only handles which month is selected
```

- **Storage:** httpOnly cookie `kmtax_v1`, JSON of `Input`, 7-day maxAge, `secure` in production. Well under the 4 KB cookie limit even for a year of bills.
- **Routing:** `/` always redirects to `/edit`. `/edit` shows the form, pre-filled (with any validation error) from the cookie. `/result` shows the results, or redirects to `/edit` when there's no valid cookie. Saving and "Try with sample data" redirect to `/result`; "Start over" asks for confirmation, then clears the cookie and goes to `/edit`. It's in the results top bar and in the form's actions row, where it only appears once something is saved or typed. In the form it also remounts the form (a key bump in the `InputForm` wrapper), so unsaved typing and old errors are cleared too. (This replaced an older `/?edit` query flag.)
- **Actions:** `saveInputs`, `loadSample` (writes the sample input), `startOver` (deletes the cookie).

## File map

| File | Purpose |
|---|---|
| `app/page.tsx` | Redirects `/` to `/edit`. |
| `app/edit/page.tsx` | Server Component. Reads the cookie and renders the pre-filled form. |
| `app/result/page.tsx` | Server Component. Reads cookie, validates, computes, renders results (or redirects to `/edit`). |
| `app/actions.ts` | Server Actions: save, load sample, start over. |
| `app/layout.tsx` | HTML shell, Google Fonts `<link>` (Barlow + Barlow Condensed). |
| `app/globals.css` | All styles. Design tokens as CSS variables at the top, dark mode via `prefers-color-scheme`. |
| `components/InputForm.tsx` | Client. Controlled form, generates month rows from dates, rate presets. |
| `components/ScrollToTop.tsx` | Client. Scrolls to the top on mount; used on `/result`, because a Server Action redirect keeps the old scroll position (seen on phones). |
| `components/StartOver.tsx` | Client. "Start over" button + native `<dialog>` confirmation; clears the cookie via `startOver`. `standalone` wraps it in its own form (results page); inside the input form its confirm button uses `formAction`. |
| `components/Guides.tsx` | Collapsible "How to find your readings" (step 1) and "Where to find your monthly bills" (step 3), with direct Ísland.is links. |
| `components/DateField.tsx` | Client. Date button + `react-day-picker` popover; posts `YYYY-MM-DD` through a hidden input. |
| `components/Results.tsx` | Server. Odometer hero, verdict, "how it gets paid" bar, "Your estimated bills from now on", footer. |
| `components/Breakdown.tsx` | Client. SVG month chart + detail panel for the selected month. |
| `lib/calc.ts` | `validate()`, `checkBills()` and `compute()`. The only place with business logic. |
| `lib/dates.ts` | UTC date helpers and `monthSlices()` (splits the period into months). |
| `lib/parse.ts` | FormData → `Input`. Handles "154.448", "154,448", "6,95", "−1.453". |
| `lib/rates.ts` | Rate presets. |
| `lib/storage.ts` | Cookie read/write (`server-only`). |
| `lib/types.ts` | `Input`, `MonthResult`, `Result`. |
| `lib/sample.ts` | The real example above. |
| `lib/calc.test.ts` | Script test against the real bill. `npm test`. |

Test expectations (`lib/calc.test.ts`):
- `SAMPLE` (with month lines): 113 days, `linesFromBill` `"all"`, months exactly 289/792/820/820 kr, settlement diff **0**, no warnings.
- `SAMPLE` without month lines (Sep bill 3.071 still in): `averageSource` `"new-rate bill"`, settlement within **10 kr** of 2.721.
- `SAMPLE` without month lines or Sep bill: `averageSource` `"readings"`, within **30 kr**, no warnings.
- Bad bills: "shifted" on May + June, "settlement" on August; with no settlement entered, August is "mismatch".
- Spring period (2026-03-30 → 2026-05-20, bills Mar 3.572 / Apr 3.725 / May 2.356): no warnings. Next-bill old estimate is 3.849 kr (May's 31 days at April's 17,87).
- `SAMPLE` upcoming bills: 3.071 (entered) / 3.173 / 3.071 kr for Sep / Oct / Nov, with Sep's `periodKr` equal to `newRateKr`.
- `SAMPLE` next bill: September old 2.279 kr (June's real bill) → new 3.071 kr, `periodKr` equal to `newRateKr`.

### The new-rate (blue) part and upcoming bills

The owner found the blue segment and column confusing ("1.026 kr, which I don't know what is"). What it is: the days after the latest reading (Sep 1–10) are part of this period's km and cost, but they're paid in the reading month's own bill at the new average. They aren't settled. The owner found them confusing anywhere they showed up as a bar, so **neither the paid bar nor the month chart shows the Sep 1–10 slice**. The 1.026 kr appears only in the detail panel when the next-bill column is selected.

**Paid bar** (`PaidBar` in `Results.tsx`) covers only the settled months: estimates + extra bill (or estimates − refund). Its heading is that span's own cost, `round(Σ settled actualKm × rate)`, e.g. "How the 10.567 kr for May 21 – Aug 31 gets paid" (10.548 kr for the sample, where the bill's month lines leave no rounding). The "rounding" legend item reconciles against that, not against `totalCostKr`. A line under the bar says the rest of the 11.593 kr (Sep 1–10) is part of the September bill and points to the chart, without giving the amount. `Result.roundingKr` (against `totalCostKr`) is no longer shown anywhere.

**Next-bill column** (`Result.nextBill`, from `nextBill()` in `calc.ts`; the owner's design): after the settled months, a dashed divider and one faded column for the reading month's **whole** bill, labelled "Next bill".
- Grey is always the old estimate at full height. `oldKr` is the real bill of the latest settled month with the same number of days (June 2.279 for September), else `median(billedKmPerDay) × days × rate`.
- The change is **amber** (`--more`) stacked on top when the new bill is higher, and **teal** (`--less`, dashed like refunds) over the top of the grey when it's lower. Red and green stay reserved for the extra bill and refund.
- The total above the column is the new bill in kr (other columns show km).
- `newKr` is the entered reading-month bill if any, else `kmPerDay × days × rate`.
- The detail panel (`NextDetail`) shows old vs new, the difference, and the part of the bill that belongs to this period.

With both readings in the same month there are no settled months, and the chart isn't rendered.

`Result.upcomingBills` (from `upcoming()` in `calc.ts`) lists the reading month and the two after it: `kmPerDay × days in month × rate`, or the entered bill for the reading month. The reading month carries `periodKr` (= `newRateKr`), but the card doesn't show it (owner: show it only in the chart's detail panel). The first card adds "Plus the extra bill of X" (or "Minus the refund") on the assumption that the settlement comes with that month's bill. This section replaces the old footer sentence based on `typicalNextBillKr`, which was removed.

## Conventions and decisions (keep these)

- **All date math in UTC** on `YYYY-MM-DD` strings so the server and browser agree regardless of time zone. The date picker (`react-day-picker` v10) runs with `timeZone="UTC"` and converts with `toUtc()` / `toISOString().slice(0, 10)`, so a picked day never shifts. Weeks start on Monday; future days and days on the wrong side of the other reading are disabled. It's themed only through `.datepop` rules in `globals.css` (overriding `--rdp-*` variables).
- **Imports use explicit `.ts`/`.tsx` extensions** (`allowImportingTsExtensions`) so `lib/*.ts` can run directly under `node --experimental-strip-types` for the test. Keep this in `lib/`. Inside `lib/`, import with relative paths (`./dates.ts`), never the `@/` alias: Node can't resolve tsconfig paths, so an alias there breaks `npm test`. `app/` and `components/` use `@/…`.
- **Cookie schema:** `readInput()` only spot-checks a few fields before `validate()` runs. If `Input` changes shape, bump the cookie name (`kmtax_v1` → `kmtax_v2`) so old cookies are ignored instead of misread. `bills` is keyed by month as `"YYYY-MM"` (from `monthSlices()`).
- **Controlled inputs in `InputForm`.** React 19 resets uncontrolled forms after a Server Action runs, which would wipe the user's input when validation fails.
- **Number display uses `de-DE`** to get Icelandic style (dot for thousands, comma for decimals): 11.593 kr, 14,76 km/day. Km on the chart are plain integers.
- **Money is rounded per month line**, like the government's bill, then summed.
- **Rates:** there's no public API for a vehicle's weight class, so the rate isn't imported. Presets + custom input only.
- **Copy:** plain, second person, sentence case, no "please"/"successfully". Errors say what's wrong and how to fix it.
- **Estimates are labelled.** Anything calculated rather than taken from the user's bills says so. The paid bar has "Estimated extra bill" / "(estimate)" unless all month lines are from the bill. The next-bill column is "Next bill (est.)" unless the reading month's bill was entered. Upcoming cards say "estimate" or "as billed", and the September card's extra bill says "estimated" unless it was entered. The footer has one general line: amounts not taken from your bills are estimates.
- **Two totals, named by date.** The hero is the whole period ("11.593 kr for the whole period, May 21 – Sep 10"). The paid bar is the settled span only ("How May 21 – Aug 31 gets paid: 10.567 kr"), and the line under it says the two together make the hero total. Keep both labelled with their date ranges.
- **Design tokens** (`globals.css`): glacier-mist background, basalt ink, gravel grey = paid by estimate, signal red = you owe, moss green = refund, fjord blue = new rate, amber / teal = next bill higher / lower than the old estimate. Barlow for text, Barlow Condensed for the odometer digits and headings. The odometer counters are the one bold element; keep the rest quiet.
- **Chart colour meaning is fixed:** grey estimate segment, red cap for missing km, green dashed cap for overpaid km, amber cap / teal dashed top for the next bill being higher / lower than the old estimate. Blue (new rate) is no longer used in the paid bar or the month chart; the "Your estimated bills from now on" card still uses it for its top border. Colours always come with a text label.

## Commands

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # prints the month table and PASS/FAIL (see "Test expectations" below)
npm run build   # verified passing: Next 15.5.26, React 19.3.0
npx tsc --noEmit  # typecheck only, faster than a build
```

**While the owner's `npm run dev` is running, never build into `.next` or delete it.** `next dev` uses the same folder, and overwriting it breaks the dev server until it's restarted. Build and preview in a separate folder instead:

```bash
NEXT_DIST_DIR=.next-build npm run build
NEXT_DIST_DIR=.next-build npx next start -p 3457
```

There's no linter and no test framework. Tests are plain scripts that `console.log` and `process.exit(1)` on failure. Run one directly with `node --experimental-strip-types lib/<name>.test.ts` (needs Node ≥ 22.6). New test files for `lib/` should follow the same pattern; if you add more, extend the `test` script to run them all.

Deploy: import the repo on Vercel (Next.js preset). No environment variables.

## Status

Done and verified:
- Production build passes; types check.
- SSR output checked with a sample cookie: verdict, paid bar, chart labels and detail panel render with the numbers above.
- Form page renders without a cookie.
- Routes and form flow, end to end in Chromium (Playwright): `/` → `/edit`; `/result` without a cookie → `/edit`; sample → `/result`; "Edit numbers" → pre-filled `/edit`; an invalid submit stays on `/edit` with the error and keeps the input; a valid submit → `/result`; "Start over" → an empty `/edit`.
- Month lines: SSR output of the sample matches the owner's reference chart. Chart labels are 836/+289/162 km, 2.279/+792/442 km, 2.356/+820/457 km ×2, 1.024/147 km (the last column has since been replaced by the next-bill column). The paid bar read "Monthly estimates · 7.827 kr | Extra bill · 2.721 kr | Sep bill · 1.024 kr" at the time; the Sep segment has since been removed. The edit form pre-fills the lines and shows "These lines add up to 2.721 kr". Chart segment labels are kr without the unit (the legend says kr).
- Calibration and verdict copy: SSR output checked with the sample cookie. Verdict reads "Your extra bill was 2.721 kr. This calculation gives 2.716 kr.", the calibration note renders, and May's +290 kr cap label is drawn above the column (segments ≤16 px put their label above; the km total moves up).
- Bill consistency check: `npm test` covers the clean sample (no warnings) and the shifted/settlement bad-data case. SSR output checked with a bad-data cookie: banner and the detail-panel warning render.

Not verified yet:
- **No visual QA in a browser.** Nobody has looked at it rendered yet. Check layout at 375 px and desktop, dark mode, and chart label overlap with many months (e.g. a 12-month period).
- Keyboard use of the chart columns (they're `role="button"` with Enter/Space).
- Live warnings in the form while typing. They recompute on every keystroke, so a half-typed amount (e.g. "23") shows a mismatch until it's finished; consider showing them only after blur if that's noisy.
- Paid-bar segments hide their text label below 150 px wide (CSS container query) and keep the amount. Checked at 960 and 375 px.
- "Charged around Sep 29" assumes the extra bill arrives with the reading month's bill, near month end, same as the "Bill paid around" hint. Confirm against a real statement.
- Help guides (`Guides.tsx`): the links (`island.is/minarsidur/eignir/okutaeki/min-okutaeki`, `…/skra-kilometrastodu`, `island.is/minarsidur/postholf`) and rules come from island.is/en/kilometer-fee and Skatturinn's news on payment slips. No official step-by-step guide with screenshots was found, and nobody has logged in to confirm the exact menu labels ("Mínar síður → Eignir → Ökutæki", "kílómetrastaða"). Check them against the live site.
- Whether the 2% tolerance holds for real bills from other users (e.g. a reading that doesn't count toward the average, or a rate change mid-period, would legitimately change the monthly estimate).

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

