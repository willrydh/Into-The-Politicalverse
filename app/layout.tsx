import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

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
        <SiteHeader />
        <main>{children}</main>
        <footer className="site-footer">
          <div className="site-footer__brand">
            <span className="wordmark__mark" aria-hidden="true"><span>PV</span></span>
            <div><strong>INTO THE POLITICALVERSE</strong><small>Databaserad valanalys.</small></div>
          </div>
          <div className="site-footer__links">
            <Link href="/forecasts">Prognos</Link>
            <Link href="/charts">Grafer</Link>
            <Link href="/parties">Partier</Link>
            <Link href="/indicators">Metod</Link>
            <a href="https://www.val.se/" target="_blank" rel="noreferrer">Valmyndigheten ↗</a>
          </div>
          <p>Oberoende analys byggd på öppna data. Inte knuten till Valmyndigheten eller något politiskt parti. Modellprognoser är inte officiella valresultat.</p>
        </footer>
      </body>
    </html>
  );
}
