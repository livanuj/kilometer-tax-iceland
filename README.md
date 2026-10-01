# Kilometer fee, explained

A small Next.js app that shows how Iceland's kilometer fee (kílómetragjald) adds up between two odometer readings:
what you drove, what your monthly estimates covered, and where the extra bill or refund comes from.

## How it works

- **No separate backend.** The form posts to a Next.js Server Action, which validates the input and stores it in an
  httpOnly cookie (7 days). The page is a React Server Component that reads the cookie, runs the calculation
  (`lib/calc.ts`) on the server and renders the result. The browser only gets finished numbers; the only client-side
  code is the form and the month selector in the chart.
- **The formula** (`lib/calc.ts`):
  - Actual km/day = (latest reading − previous reading) ÷ days between them
  - Each monthly estimate bill covered `bill ÷ rate ÷ days in month` km/day
  - For every month billed before the latest reading: `(actual − billed km/day) × days of that month in the period × rate`
    → summed, that's the extra bill (+) or refund (−)
  - The month of the latest reading is billed afterwards at the new rate, so it isn't corrected
  - The period runs from the day after the previous reading to the day of the latest one

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # checks the calculation against a real bill
```

## Deploy to Vercel

Push the folder to a GitHub repo and import it on vercel.com (framework preset: Next.js), or run `npx vercel`.
No environment variables are needed.

## Rates

`lib/rates.ts` has the 2026 rates published on island.is (cars up to 3.5 t: 6,95 kr/km; motorcycles: 4,15 kr/km).
There's no public API to look up a vehicle's weight class, so other vehicles enter the rate from their bill.
# kilometer-tax-iceland
