"use client";
import Link from "next/link";
import { StatisticsSettings } from "./insights/statistics-consent";
import { Localize } from "@/components/localize";
import { SiteBrand } from "./site-brand";

export function SiteFooter() { return <Localize><footer className="site-footer">
          <div className="site-footer__brand">
            <SiteBrand />
            <small>Databaserad valanalys.</small>
          </div>
          <div className="site-footer__links">
            <Link href="/forecasts">Prognos</Link>
            <Link href="/charts">Grafer</Link>
            <Link href="/parties">Partier</Link>
            <Link href="/indicators">Metod</Link>
            <Link href="/sources">Datakällor</Link>
            <Link href="/privacy">Integritet</Link>
            <StatisticsSettings />
            <Link href="/press/">Press</Link>
            <a href="https://www.val.se/" target="_blank" rel="noreferrer">Valmyndigheten ↗</a>
          </div>
          <p>Oberoende analys byggd på öppna data. Inte knuten till Valmyndigheten eller något politiskt parti. Modellprognoser är inte officiella valresultat.</p>
        </footer></Localize>; }
