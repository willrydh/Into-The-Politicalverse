import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "../globals.css";
import { LocaleProvider } from "@/components/localize";
import { SiteLocationProvider } from "@/components/site-location";
import { ThemeInit } from "@/components/theme-init";
import { brandMetadata } from "@/lib/brand-metadata";

export const metadata: Metadata = {
  ...brandMetadata("sv"),
  title: {
    default: "Politicalverse — Databaserad valprognos 2026",
    template: "%s — Politicalverse",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><ThemeInit /></head>
      <body>
        <LocaleProvider locale="sv"><SiteLocationProvider><SiteHeader />
        <main>{children}</main>
        <SiteFooter /></SiteLocationProvider></LocaleProvider>
      </body>
    </html>
  );
}
