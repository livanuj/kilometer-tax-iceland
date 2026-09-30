// Per-km rates published on island.is (2026). There is no public API for
// looking up a vehicle's weight class, so the user picks a preset or types
// the rate printed on their bill ("6,95 kr/km").
export type RatePreset = { id: string; label: string; rate: number | null; hint: string };

export const RATE_PRESETS: RatePreset[] = [
  { id: "car", label: "Car or SUV up to 3.5 t", rate: 6.95, hint: "Most private cars" },
  { id: "moto", label: "Motorcycle up to 400 kg", rate: 4.15, hint: "" },
  { id: "custom", label: "Other rate", rate: null, hint: "Heavier vehicles pay more. Use the kr/km shown on your bill." },
];

export function presetForRate(rate: number | undefined): string {
  const hit = RATE_PRESETS.find((p) => p.rate !== null && p.rate === rate);
  return hit ? hit.id : rate ? "custom" : "car";
}
