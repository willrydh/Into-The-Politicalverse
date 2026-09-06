import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "../globals.css";
import { LocaleProvider } from "@/components/localize";

export const metadata: Metadata = {
  title: {
    default: "Politicalverse — Data-driven election forecast 2026",
    template: "%s — Politicalverse",
  },
  description: "Swedish election forecasts with open polling data, seat intervals, government context, official results and transparent methodology.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <LocaleProvider locale="en"><SiteHeader />
        <main>{children}</main>
        <SiteFooter /></LocaleProvider>
      </body>
    </html>
  );
}
