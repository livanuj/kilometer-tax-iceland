"use client";

import { useEffect } from "react";

// A Server Action redirect (saving the form) doesn't reset scroll, so the new page would
// open at the old position, e.g. the bottom of the form on a phone. Start at the top.
export default function ScrollToTop() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return null;
}
