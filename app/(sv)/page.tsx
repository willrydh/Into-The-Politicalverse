import { pageMetadata } from "@/lib/page-metadata";
import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import Link from "next/link";
import { DataSource } from "@/components/data-source";
import { NationalBaseline } from "@/components/charts/national-baseline";
import { NationalTrendChart } from "@/components/charts/national-trend-chart";
import { ForecastHero } from "@/components/forecast/forecast-hero";
import { nationalHistory } from "@/lib/data/elections";
import { CurrentForecast } from "@/components/forecast/current-forecast";

export const metadata = pageMetadata("", "sv");

export default function Home({ locale = "sv" }: { locale?: Locale } = {}) {
  const explore = [
    { index: "01", title: "Hela prognosen", copy: "Löpande valnattsprognos, mandat, regeringsvägar och öppna metodtester.", href: "/forecasts", metric: "Valnattens prognos" },
    { index: "02", title: "Officiella grafer", copy: "Följ varje riksdagspartis slutresultat genom den jämförbara valhistoriken.", href: "/charts", metric: `${nationalHistory.elections.length} val` },
    { index: "03", title: "Sverigekartan", copy: "Utforska Valmyndighetens resultat kommun för kommun, parti för parti.", href: "/maps", metric: "290 kommuner" },
    { index: "04", title: "Mandatsimulator", copy: "Bygg ett eget röstandelsscenario och se hur den svenska mandatmatematiken slår.", href: "/simulator", metric: "349 mandat" },
  ];

  return localizeNode((
    <>
      <ForecastHero />
      <div className="live-home-link"><Link href="/valnatt">Till valnattens presentation →</Link><Link href="/valnatt#svt-valu">SVT:s Valu 2026 →</Link></div>
      <CurrentForecast compact />
      <div className="live-home-link"><Link href="/forecasts#fore-valet">Prognosen före valet · arkiv →</Link></div>

      <section className="official-bridge">
        <div className="official-bridge__heading">
          <div><p className="eyebrow eyebrow--dark">OFFICIAL · Valmyndigheten</p><h2>Prognosen börjar i facit.</h2></div>
          <p>Modellen hålls åtskild från officiella fakta. Den historiska grafen nedan visar fastställda röstandelar — inte modellvärden — och fungerar som öppet jämförelsematerial.</p>
        </div>
        <div className="chart-product-grid">
          <NationalTrendChart history={nationalHistory} compact />
          <NationalBaseline />
        </div>
        <div className="official-bridge__footer"><DataSource /><Link className="text-link" href="/charts">Utforska all historik <span>→</span></Link></div>
      </section>

      <section className="explore-section explore-section--forecast">
        <div className="explore-section__intro">
          <p className="eyebrow eyebrow--light">Utforska Politicalverse</p>
          <h2>Från sannolikhet<br />till belägg.</h2>
          <p>Öppet utan konto. Prognos, officiella resultat och metod hålls tydligt klassificerade som MODEL, OFFICIAL eller DERIVED.</p>
        </div>
        <div className="explore-grid explore-grid--compact">
          {explore.map((item) => (
            <Link href={item.href} className="explore-card" key={item.title}>
              <span>{item.index}</span>
              <div><h3>{item.title}</h3><p>{item.copy}</p></div>
              <footer><strong>{item.metric}</strong><b>↗</b></footer>
            </Link>
          ))}
        </div>
      </section>
    </>
  ), locale);
}
