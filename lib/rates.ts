// Per-km rates published on island.is (2026). There is no public API for
// looking up a vehicle's weight class, so the user picks a preset or types
// the rate printed on their bill ("6,95 kr/km").
// Labels are in messages/*.json under "rates.<id>".
export type RatePreset = { id: "car" | "moto" | "custom"; rate: number | null };

export const RATE_PRESETS: RatePreset[] = [
  { id: "car", rate: 6.95 },
  { id: "moto", rate: 4.15 },
  { id: "custom", rate: null },
];

export function presetForRate(rate: number | undefined): RatePreset["id"] {
  const hit = RATE_PRESETS.find((p) => p.rate !== null && p.rate === rate);
  return hit ? hit.id : rate ? "custom" : "car";
}
