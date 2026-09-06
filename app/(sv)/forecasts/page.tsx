import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import Link from "next/link";
import { ForecastEvidenceStrip } from "@/components/forecast/evidence-strip";
import { ForecastBacktests, ForecastDrivers, ForecastMethod } from "@/components/forecast/forecast-details";
import { ForecastHistory } from "@/components/forecast/forecast-history";
import { ForecastFreshness } from "@/components/forecast/forecast-freshness";
import { GovernmentFormation } from "@/components/forecast/government-formation";
import { PartySeatForecast } from "@/components/forecast/party-seat-forecast";
import { PredictionGrid } from "@/components/forecast/prediction-grid";
import { SectionHeading } from "@/components/section-heading";
import { electionForecast } from "@/lib/forecast/data";

export const metadata: Metadata = {
  title: "Prognos 2026",
  description: "Databaserad valprognos för riksdagsvalet 2026 med mandatintervall, regeringsvägar, historiska test och öppna källor.",
};

function probability(value: number): string {
  if (value >= 0.9995) return ">99,9 %";
  if (value <= 0.0005) return "<0,1 %";
  return `${(value * 100).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} %`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export default function ForecastsPage({ locale = "sv" }: { locale?: Locale } = {}) {
  const headline = electionForecast.questions[0];

  return localizeNode((
    <>
      <section className="forecast-page-hero">
        <div className="forecast-page-hero__copy">
          <ForecastFreshness dataCutoff={electionForecast.model.dataCutoff} electionDate={electionForecast.model.electionDate} />
          <p className="eyebrow eyebrow--light"><span /> Sverige · Riksdagsvalet 2026</p>
          <h1>Prognos&shy;terminalen</h1>
          <p>En sammanhängande modell från publicerade opinionsmätningar till röstandelar, mandat och möjliga regeringsvägar. Alla sannolikheter visar simuleringsfrekvens — aldrig bettingodds.</p>
          <div className="forecast-page-hero__links">
            <a href="#fragor">Börja med frågorna <span>↓</span></a>
            <a href="#metod">Granska metod och källor <span>↓</span></a>
          </div>
        </div>
        <article className="forecast-page-hero__signal">
          <header><span>HUVUDSIGNAL · MODEL</span><b>{electionForecast.status}</b></header>
          <p>{headline.question}</p>
          <strong>{probability(headline.probability)}</strong>
          <div role="progressbar" aria-label={headline.question} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(headline.probability * 100)}><span style={{ width: `${headline.probability * 100}%` }} /></div>
          <dl>
            <div><dt>Datastopp</dt><dd>{formatDate(electionForecast.model.dataCutoff)}</dd></div>
            <div><dt>Snapshot</dt><dd>{electionForecast.snapshotId}</dd></div>
            <div><dt>Körningar</dt><dd>{electionForecast.model.simulations.toLocaleString("sv-SE")}</dd></div>
          </dl>
        </article>
      </section>

      <ForecastEvidenceStrip forecast={electionForecast} />

      <nav className="forecast-jump-nav" aria-label="Prognosens avsnitt">
        <div>
          <a href="#fragor">Frågor</a>
          <a href="#partier">Partier</a>
          <a href="#regering">Regering</a>
          <a href="#historik">Rörelse</a>
          <a href="#backtest">Historiska test</a>
          <a href="#metod">Metod & integritet</a>
        </div>
      </nav>

      <section className="product-section forecast-section" id="fragor">
        <SectionHeading
          eyebrow="Prognosfrågor"
          title="Ett precist svar kräver en precis fråga"
          aside={<><span className="section-kicker">{electionForecast.questions.length} DEFINITIONER</span><p>Samtliga klassificerade MODEL</p></>}
        />
        <p className="forecast-section__lead">Frågorna är fördefinierade så att resultatet går att kontrollera efter valet. Sannolikheten är andelen av simuleringarna där villkoret uppfylls. Den säger inget om vad du bör hoppas på.</p>
        <PredictionGrid forecast={electionForecast} />
      </section>

      <section className="product-section forecast-section forecast-section--paper" id="partier">
        <SectionHeading
          eyebrow="Partiprognos · röster och mandat"
          title="Mittpunkt, spann och spärrrisk"
          aside={<><span className="section-kicker">{electionForecast.model.simulations.toLocaleString("sv-SE")} UTFALL</span><p>80-procentiga modellintervall</p></>}
        />
        <p className="forecast-section__lead">Röstintervallet kommer från mätningarnas spridning och historiska prognosfel. Varje simulerad röstandel räknas därefter genom mandatmotorn; därför kan mandaten förändras språngvis vid spärren.</p>
        <PartySeatForecast forecast={electionForecast} />
      </section>

      <section className="product-section forecast-section">
        <SectionHeading
          eyebrow="Prognosens känslighet"
          title="Vad driver utfallet just nu?"
          aside={<><span className="section-kicker">DIAGNOSTIK</span><p>Härlett ur samma snapshot</p></>}
        />
        <p className="forecast-section__lead">Detta är en läsnyckel till prognosen: partiet närmast spärren, sannolik största parti, mandatbasen närmast 175 och det bredaste mandatintervallet.</p>
        <ForecastDrivers forecast={electionForecast} />
      </section>

      <section className="forecast-government-section" id="regering">
        <div className="forecast-government-section__inner">
          <SectionHeading
            eyebrow="Regeringsbildning · modell + daterad kontext"
            title="Mandat räcker inte ensamma"
            aside={<><span className="section-kicker section-kicker--light">MODEL / DECLARED / CONTEXT</span><p>Separata evidenslager</p></>}
          />
          <p className="forecast-section__lead">Koalitionsraderna visar matematiken. Under dem visas partiledare och offentliga regeringslinjer med datum och källänk. Vi sätter inte sannolikheter på ministerposter utan ett testbart personurval och en separat modell.</p>
          <GovernmentFormation forecast={electionForecast} />
        </div>
      </section>

      <section className="product-section forecast-section" id="historik">
        <SectionHeading
          eyebrow="Prognosens utveckling"
          title="Nya datapunkter, synlig rörelse"
          aside={<><span className="section-kicker">FRÅN {formatDate(electionForecast.trend[0].date).toLocaleUpperCase("sv-SE")}</span><p>Till datastopp {formatDate(electionForecast.model.dataCutoff)}</p></>}
        />
        <p className="forecast-section__lead">Historiken byggs med vad som var publicerat vid varje datum. Den gör det möjligt att skilja en stabil prognos från en rörelse som drivs av en enda ny mätning.</p>
        <ForecastHistory forecast={electionForecast} />
      </section>

      <section className="product-section forecast-section forecast-section--paper" id="backtest">
        <SectionHeading
          eyebrow="Historisk kontroll"
          title="Vi visar var modellen hade fel"
          aside={<><span className="section-kicker">{electionForecast.evidence.comparableBacktestElections} JÄMFÖRBARA VAL</span><p>{electionForecast.evidence.backtestPartyOutcomes} partiutfall</p></>}
        />
        <p className="forecast-section__lead">För varje historiskt val stoppas inflödet lika långt före valdagen som dagens prognos. Prognosen jämförs sedan med det officiella utfallet, parti för parti.</p>
        <ForecastBacktests forecast={electionForecast} />
      </section>

      <section className="product-section forecast-section" id="metod">
        <SectionHeading
          eyebrow="Metod och dataintegritet"
          title="Från rå rad till reproducerbar snapshot"
          aside={<a className="text-link" href={electionForecast.source.repositoryUrl} target="_blank" rel="noreferrer">Öppna källdataset <span>↗</span></a>}
        />
        <p className="forecast-section__lead">OFFICIAL, POLL, MODEL och politisk CONTEXT blandas aldrig ihop. Här syns flödet, versionsnycklarna, kontrollkällorna och begränsningarna som följer med publiceringen.</p>
        <ForecastMethod forecast={electionForecast} />
      </section>

      <aside className="forecast-next-step">
        <div><span>BYGG EGET SCENARIO</span><h2>Prognosen är inte en låst sanning.</h2><p>Öppna simulatorn om du vill förstå hur ett annat röstläge skulle översättas till mandat. Ditt scenario ändrar aldrig den publicerade prognosen.</p></div>
        <Link className="button button--acid" href="/simulator">Till mandatsimulatorn <span>→</span></Link>
      </aside>
    </>
  ), locale);
}
