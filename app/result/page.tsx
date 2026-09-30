import { redirect } from "next/navigation";
import { compute, validate } from "@/lib/calc.ts";
import { readInput } from "@/lib/storage.ts";
import Results from "@/components/Results.tsx";
import ScrollToTop from "@/components/ScrollToTop.tsx";

// Everything is calculated here, on the server, from the cookie.
// The browser only receives finished numbers. Nothing valid saved: back to the form.
export default async function ResultPage() {
  const input = await readInput();
  if (!input || validate(input)) redirect("/edit");
  return (
    <>
      <ScrollToTop />
      <Results result={compute(input)} />
    </>
  );
}
