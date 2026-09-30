import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kilometer tax, explained",
  description: "See how your Icelandic kilometer tax (kílómetragjald) estimates, extra bills and refunds add up.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600&display=swap"
        />
      </head>
      <body>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
