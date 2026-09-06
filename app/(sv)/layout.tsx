import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "../globals.css";
import { LocaleProvider } from "@/components/localize";
import { SiteLocationProvider } from "@/components/site-location";

export const metadata: Metadata = {
  title: {
    default: "Politicalverse — Databaserad valprognos 2026",
    template: "%s — Politicalverse",
  },
  description: "Svensk valprognos med öppna mätdata, mandatintervall, regeringsvägar, officiell valhistorik och synlig metod.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv" data-scroll-behavior="smooth">
      <body>
        <LocaleProvider locale="sv"><SiteLocationProvider><SiteHeader />
        <main>{children}</main>
        <SiteFooter /></SiteLocationProvider></LocaleProvider>
      </body>
    </html>
  );
}
