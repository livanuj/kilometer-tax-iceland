import type { Input } from "./types.ts";

// Real example: readings from Ísland.is and bills paid between them.
export const SAMPLE: Input = {
  prevDate: "2026-05-20",
  prevKm: 154448,
  currDate: "2026-09-10",
  currKm: 156116,
  rate: 6.95,
  bills: { "2026-05": 2356, "2026-06": 2279, "2026-07": 2356, "2026-08": 2356, "2026-09": 3071 },
  settlement: 2721,
};
