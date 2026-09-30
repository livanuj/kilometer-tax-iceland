import { validate } from "@/lib/calc.ts";
import { readInput } from "@/lib/storage.ts";
import InputForm from "@/components/InputForm.tsx";

// The form, pre-filled from the cookie when there's saved input.
export default async function EditPage() {
  const input = await readInput();
  return <InputForm initial={input} initialError={input ? validate(input) : null} />;
}
