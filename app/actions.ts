"use server";

import { redirect } from "next/navigation";
import { validate } from "@/lib/calc.ts";
import { parseForm } from "@/lib/parse.ts";
import { SAMPLE } from "@/lib/sample.ts";
import { clearInput, writeInput } from "@/lib/storage.ts";

export type FormState = { error: string | null };

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
