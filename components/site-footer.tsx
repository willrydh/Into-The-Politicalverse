"use client";
import Link from "next/link";
import { Localize } from "@/components/localize";

export function SiteFooter() { return <Localize><footer className="site-footer">
          <div className="site-footer__brand">
            <span className="wordmark__mark" aria-hidden="true"><span>PV</span></span>
            <div><strong>INTO THE POLITICALVERSE</strong><small>Databaserad valanalys.</small></div>
          </div>
          <div className="site-footer__links">
            <Link href="/forecasts">Prognos</Link>
            <Link href="/charts">Grafer</Link>
            <Link href="/parties">Partier</Link>
            <Link href="/indicators">Metod</Link>
            <Link href="/sources">Datakällor</Link>
            <a href="https://www.val.se/" target="_blank" rel="noreferrer">Valmyndigheten ↗</a>
          </div>
          <p>Oberoende analys byggd på öppna data. Inte knuten till Valmyndigheten eller något politiskt parti. Modellprognoser är inte officiella valresultat.</p>
        </footer></Localize>; }
