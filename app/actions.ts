"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE, isLocale } from "@/i18n/locales.ts";
import { validate } from "@/lib/calc.ts";
import type { ValidationError } from "@/lib/types.ts";
import { parseForm } from "@/lib/parse.ts";
import { SAMPLE } from "@/lib/sample.ts";
import { clearInput, writeInput } from "@/lib/storage.ts";

export type FormState = { error: ValidationError | null };

export async function saveInputs(_prev: FormState, fd: FormData): Promise<FormState> {
  const input = parseForm(fd);
  const error = validate(input);
  if (error) return { error };
  await writeInput(input);
  redirect("/result");
}

export async function loadSample() {
  await writeInput(SAMPLE);
  redirect("/result");
}

export async function startOver() {
  await clearInput();
  redirect("/edit");
}

// Setting a cookie in a Server Action re-renders the current page, so the new language shows at once
// and whatever is typed in the form stays.
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
