import "server-only";
import { cookies } from "next/headers";
import type { Input } from "./types.ts";

export const COOKIE = "kmtax_v1";

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // kept for a week, then forgotten
};

export async function readInput(): Promise<Input | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Input;
    if (typeof v.prevDate !== "string" || typeof v.rate !== "number" || typeof v.bills !== "object") return null;
    return { ...v, settlement: typeof v.settlement === "number" ? v.settlement : null };
  } catch {
    return null;
  }
}

export async function writeInput(input: Input) {
  (await cookies()).set(COOKIE, JSON.stringify(input), cookieOptions);
}

export async function clearInput() {
  (await cookies()).delete(COOKIE);
}
