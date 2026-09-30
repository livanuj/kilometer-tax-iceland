import { redirect } from "next/navigation";

// The form is the starting point; results live at /result.
export default function Home() {
  redirect("/edit");
}
