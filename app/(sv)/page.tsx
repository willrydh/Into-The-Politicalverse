import { pageMetadata } from "@/lib/page-metadata";
import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import Link from "next/link";
import { DataSource } from "@/components/data-source";
import { NationalBaseline } from "@/components/charts/national-baseline";
import { NationalTrendChart } from "@/components/charts/national-trend-chart";
import { ForecastEvidenceStrip } from "@/components/forecast/evidence-strip";
import { ForecastDrivers } from "@/components/forecast/forecast-details";
import { ForecastHero } from "@/components/forecast/forecast-hero";
import { ForecastHistory } from "@/components/forecast/forecast-history";
import { GovernmentFormation } from "@/components/forecast/government-formation";
import { PartySeatForecast } from "@/components/forecast/party-seat-forecast";
import { PredictionGrid } from "@/components/forecast/prediction-grid";
import { SectionHeading } from "@/components/section-heading";
import { nationalHistory } from "@/lib/data/elections";
import { electionForecast } from "@/lib/forecast/data";

export const metadata = pageMetadata("", "sv");

export default function Home({ locale = "sv" }: { locale?: Locale } = {}) {
  const explore = [
    { index: "01", title: "Hela prognosen", copy: "Alla frågor, mandatintervall, regeringsvägar, historiska test och källregister.", href: "/forecasts", metric: `${electionForecast.questions.length} prognosfrågor` },
    { index: "02", title: "Officiella grafer", copy: "Följ varje riksdagspartis slutresultat genom den jämförbara valhistoriken.", href: "/charts", metric: `${electionForecast.evidence.officialHistoryElections} val` },
    { index: "03", title: "Sverigekartan", copy: "Utforska Valmyndighetens resultat kommun för kommun, parti för parti.", href: "/maps", metric: `${electionForecast.evidence.officialMunicipalities} kommuner` },
    { index: "04", title: "Mandatsimulator", copy: "Bygg ett eget röstandelsscenario och se hur den svenska mandatmatematiken slår.", href: "/simulator", metric: `${electionForecast.centralScenario.majoritySeats * 2 - 1} mandat` },
  ];

  return localizeNode((
    <>
      <ForecastHero forecast={electionForecast} />
      <div className="live-home-link"><Link href="/valnatt">Till valnattens presentation →</Link><span>Mer data redan före valnatten</span></div>
      <ForecastEvidenceStrip forecast={electionForecast} />

      <section className="product-section forecast-section" id="prognosfragor">
        <SectionHeading
          eyebrow="Prognosfrågor · tydliga definitioner"
          title="Frågorna som formar valnatten"
          aside={<><span className="section-kicker">MODEL · BETA</span><p>Frekvens i simulerade val, inte bettingodds</p></>}
        />
        <p className="forecast-section__lead">Varje kort svarar på en avgränsad fråga. Procentsiffran visar hur ofta villkoret uppfylldes i modellens möjliga valutfall; öppna definitionen för att se exakt hur frågan avgörs.</p>
        <PredictionGrid forecast={electionForecast} limit={5} />
      </section>

      <section className="product-section forecast-section forecast-section--paper">
        <SectionHeading
          eyebrow="Röstprognos → mandat"
          title="Ett val är ett spann, inte en stapel"
          aside={<Link className="text-link" href="/forecasts#metod">Så räknar modellen <span>→</span></Link>}
        />
        <p className="forecast-section__lead">Mittpunkten är modellens mest koncentrerade scenario. Intervallen visar var den mittersta delen av simuleringarna hamnar och gör osäkerheten synlig innan mandat diskuteras.</p>
        <PartySeatForecast forecast={electionForecast} />
      </section>

      <section className="product-section forecast-section">
        <SectionHeading
          eyebrow="Det som driver prognosen"
          title="Fyra signaler att förstå först"
          aside={<><span className="section-kicker">MODEL · FÖRKLARING</span><p>Automatiskt härlett ur aktuell snapshot</p></>}
        />
        <p className="forecast-section__lead">Spärren, största parti, avståndet till 175 och mandatspannet förklarar varför sannolikheterna ser ut som de gör. De är diagnostik, inte separata opinionsmätningar.</p>
        <ForecastDrivers forecast={electionForecast} />
      </section>

      <section className="forecast-government-section">
        <div className="forecast-government-section__inner">
          <SectionHeading
            eyebrow="Mandat möter politik"
            title="Vem kan faktiskt bilda regering?"
            aside={<Link className="text-link text-link--light" href="/forecasts#regering">Partiernas deklarerade linjer <span>→</span></Link>}
          />
          <p className="forecast-section__lead">Modellen räknar mandatbaser. Den påstår inte att en matematisk majoritet automatiskt blir en regering: negativ parlamentarism, tolerans och partiernas offentliga villkor avgör nästa steg.</p>
          <GovernmentFormation forecast={electionForecast} compact />
        </div>
      </section>

      <section className="product-section forecast-section">
        <SectionHeading
          eyebrow="Prognosens rörelse"
          title="Vad har faktiskt förändrats?"
          aside={<><span className="section-kicker">MODEL · TIDSSERIE</span><p>Endast information publicerad vid respektive datum</p></>}
        />
        <p className="forecast-section__lead">Här syns mandatmittpunkten när nya publicerade mätningar kommer in. En rörelse visar att modellens underlag har ändrats — inte att väljare säkert har bytt sida.</p>
        <ForecastHistory forecast={electionForecast} />
      </section>

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
