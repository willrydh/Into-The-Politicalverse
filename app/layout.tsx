import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Into The Politicalverse",
  description: "Quantitative election analysis, built from official data.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}