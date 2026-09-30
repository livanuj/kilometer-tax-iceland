import { compute, validate } from "@/lib/calc.ts";
import { readInput } from "@/lib/storage.ts";
import InputForm from "@/components/InputForm.tsx";
import Results from "@/components/Results.tsx";

// Everything is calculated here, on the server, from the cookie.
// The browser only receives finished numbers.
export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const input = await readInput();
  const invalid = input ? validate(input) : null;

  if (!input || edit !== undefined || invalid) {
    return <InputForm initial={input} initialError={invalid} />;
  }
  return <Results result={compute(input)} />;
}
