import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Politicalverse — Quantitative election analysis",
    template: "%s — Politicalverse",
  },
  description: "Official Swedish election data, historical change and transparent Politicalverse indicators.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <footer className="site-footer">
          <div className="site-footer__brand">
            <span className="wordmark__mark" aria-hidden="true"><span>PV</span></span>
            <div><strong>INTO THE POLITICALVERSE</strong><small>Quantitative election analysis.</small></div>
          </div>
          <div className="site-footer__links">
            <Link href="/charts">Charts</Link>
            <Link href="/parties">Parties</Link>
            <Link href="/indicators">Methodology</Link>
            <Link href="/simulator">Simulator</Link>
            <a href="https://www.val.se/" target="_blank" rel="noreferrer">Valmyndigheten ↗</a>
          </div>
          <p>Independent analysis built on public data. Not affiliated with Valmyndigheten or any political party.</p>
        </footer>
      </body>
    </html>
  );
}
