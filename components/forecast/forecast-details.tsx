"use client";
import { Localize } from "@/components/localize";
import { PartyMark } from "@/components/party-mark";
import { PartyText } from "@/components/party-label";
import { PARTIES } from "@/lib/parties";
import type { ElectionForecast, ForecastBacktestElection } from "@/lib/forecast/types";
import type { SimulatorPartyId } from "@/lib/simulator/types";

function pct(value: number, digits = 1): string {
  return `${(value * 100).toLocaleString("sv-SE", { maximumFractionDigits: digits })} %`;
}

function decimal(value: number): string {
  return value.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
}

function date(value: string): string {
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function largestMiss(backtest: ForecastBacktestElection): { partyId: SimulatorPartyId; difference: number } {
  return Object.entries(backtest.prediction)
    .map(([partyId, prediction]) => ({
      partyId: partyId as SimulatorPartyId,
      difference: prediction - backtest.actual[partyId as SimulatorPartyId],
    }))
    .sort((left, right) => Math.abs(right.difference) - Math.abs(left.difference))[0];
}

export function ForecastDrivers({ forecast }: { forecast: ElectionForecast }) {
  const thresholdRisk = [...forecast.parties].sort((left, right) => left.thresholdProbability - right.thresholdProbability)[0];
  const largestParty = [...forecast.parties].sort((left, right) => right.largestPartyProbability - left.largestPartyProbability)[0];
  const closestCoalition = [...forecast.coalitions].sort(
    (left, right) => Math.abs(left.centralSeats - forecast.centralScenario.majoritySeats) - Math.abs(right.centralSeats - forecast.centralScenario.majoritySeats),
  )[0];
  const widestInterval = [...forecast.parties].sort(
    (left, right) => (right.seatInterval80[1] - right.seatInterval80[0]) - (left.seatInterval80[1] - left.seatInterval80[0]),
  )[0];

  return <Localize>{(
    <div className="forecast-drivers">
      <article>
        <span>SPÄRRLÄGE</span>
        <strong><PartyMark party={PARTIES[thresholdRisk.partyId]} size="lg"/></strong>
        <h3>{pct(thresholdRisk.thresholdProbability)} över riksdagsspärren</h3>
        <p>Små rörelser runt fyra procent kan flytta många mandat mellan blocken. Detta är modellens känsligaste tröskel just nu.</p>
      </article>
      <article>
        <span>STÖRSTA PARTI</span>
        <strong><PartyMark party={PARTIES[largestParty.partyId]} size="lg"/></strong>
        <h3>{pct(largestParty.largestPartyProbability)} modellfrekvens</h3>
        <p>{PARTIES[largestParty.partyId].name} blir störst i denna andel av simuleringarna. Det stärker ett förhandlingsläge men utser inte statsminister.</p>
      </article>
      <article>
        <span>NÄRMAST 175</span>
        <strong>{closestCoalition.centralSeats}</strong>
        <h3><PartyText>{closestCoalition.name}</PartyText></h3>
        <p>Mittscenariot ligger {Math.abs(closestCoalition.centralSeats - forecast.centralScenario.majoritySeats)} mandat från majoritetsgränsen. Politisk förenlighet modelleras separat som källbelagd kontext.</p>
      </article>
      <article>
        <span>STÖRST MANDATSPANN</span>
        <strong>{widestInterval.seatInterval80[0]}–{widestInterval.seatInterval80[1]}</strong>
        <h3>{PARTIES[widestInterval.partyId].name}</h3>
        <p>Det bredaste 80-procentiga intervallet visar var mandatutfallet varierar mest i simuleringarna — inte att ytterkanterna är omöjliga.</p>
      </article>
    </div>
  )}</Localize>;
}

export function ForecastBacktests({ forecast }: { forecast: ElectionForecast }) {
  return <Localize>{(
    <div className="backtest-product">
      <div className="backtest-table" role="table" aria-label="Historisk kontroll av prognosmodellen">
        <div className="backtest-table__head" role="row">
          <span role="columnheader">Val</span><span role="columnheader">Roll</span><span role="columnheader">Datagrund</span><span role="columnheader">Medelfel</span><span role="columnheader">Största avvikelse</span>
        </div>
        {forecast.backtests.map((backtest) => {
          const miss = largestMiss(backtest);
          return (
            <article className="backtest-row" role="row" key={backtest.year}>
              <div role="cell"><strong>{backtest.year}</strong><span>stopp {date(backtest.cutoff)}</span></div>
              <div role="cell"><span className={`backtest-role backtest-role--${backtest.role}`}>{backtest.role === "holdout" ? "LÅST TEST" : "KALIBRERING"}</span></div>
              <div role="cell"><strong>{backtest.polls} mätningar</strong><span>{backtest.houses} institut</span></div>
              <div role="cell"><strong>{decimal(backtest.meanAbsoluteError)}</strong><span>procentenheter</span></div>
              <div role="cell"><strong><PartyMark party={PARTIES[miss.partyId]} size="inline"/> {miss.difference > 0 ? "+" : ""}{decimal(miss.difference)}</strong><span>prognos minus utfall</span></div>
            </article>
          );
        })}
      </div>
      <div className="backtest-summary">
        <article><span>SAMTLIGA PARTIUTFALL</span><strong>{forecast.evidence.backtestPartyOutcomes}</strong><p>Jämförbara utfall från {forecast.evidence.comparableBacktestElections} val.</p></article>
        <article><span>GENOMSNITTLIGT ABSOLUTFEL</span><strong>{decimal(forecast.quality.allBacktestMeanAbsoluteError)}</strong><p>Procentenheter över samtliga redovisade partiutfall.</p></article>
        <article><span>80 %-INTERVALLENS TRÄFF</span><strong>{pct(forecast.quality.leaveOneElectionOutIntervalCoverage80)}</strong><p>Historisk täckning i lämna-ett-val-ut-kontrollen. Ett 80 %-intervall är alltså inte en garanti.</p></article>
      </div>
      <p className="forecast-caveat"><strong>Så ska kontrollen läsas:</strong> Den frysta designen bedöms mot 2010–2018 och 2022 hålls undan som ett låst sluttest. Repositoriet återskapar den fasta modellen, inte en uttömmande parameterjakt. Fyra val är ett litet underlag; historiska fel kan underskatta nya politiska skiften.</p>
    </div>
  )}</Localize>;
}

export function ForecastMethod({ forecast }: { forecast: ElectionForecast }) {
  const steps = [
    {
      title: "Publicerade mätningar",
      copy: `${forecast.evidence.currentWindowPolls.toLocaleString("sv-SE")} mätningar från ${forecast.evidence.currentWindowHouses.toLocaleString("sv-SE")} mätserier ingår i det aktuella fönstret. En mätning blir tillgänglig först på publiceringsdagen.`,
    },
    {
      title: "Tid och institut",
      copy: `Nyare fältarbete väger mer med ${forecast.model.halfLifeDays} dagars halveringstid. Ett institut får som mest ${pct(forecast.model.maximumHouseWeight, 0)} av den realiserade vikten.`,
    },
    {
      title: "Historiskt prognosfel",
      copy: `${forecast.evidence.comparableBacktestElections} jämförbara val används för partiernas gemensamma osäkerhet. 2002 och 2006 ligger kvar i den officiella historiken men exkluderas från åttapartitestet.`,
    },
    {
      title: "Mandat, varje gång",
      copy: `${forecast.model.simulations.toLocaleString("sv-SE")} möjliga röstandelar körs genom samma prövade mandatmotor med ${forecast.evidence.officialConstituencies} valkretsar och utjämningsmandat.`,
    },
  ];

  return <Localize>{(
    <div className="forecast-method">
      <div className="forecast-method__flow">
        {steps.map((step, index) => (
          <article key={step.title}><span>0{index + 1}</span><h3>{step.title}</h3><p>{step.copy}</p></article>
        ))}
      </div>
      <div className="forecast-integrity">
        <div className="forecast-integrity__intro">
          <span>INTEGRITETSREGISTER</span>
          <h3>Varje prognos går att återskapa.</h3>
          <p>Snapshot, källdataset, kodversion och kontroller visas tillsammans. Om en uppdatering inte klarar verifieringen ska den senast godkända prognosen ligga kvar.</p>
          <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/forecasts/2026.json`} download="politicalverse-prognos-2026.json">Hämta snapshot (JSON) <span>→</span></a>
        </div>
        <dl>
          <div><dt>Klassificering</dt><dd>{forecast.classification} · {forecast.status}</dd></div>
          <div><dt>Snapshot</dt><dd><code>{forecast.snapshotId}</code></dd></div>
          <div><dt>Modellversion</dt><dd><code>{forecast.model.version}</code></dd></div>
          <div><dt>Datastopp</dt><dd>{date(forecast.model.dataCutoff)}</dd></div>
          <div><dt>Genererad</dt><dd>{new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(new Date(forecast.model.generatedAt))}</dd></div>
          <div><dt>Rådata</dt><dd>{forecast.evidence.pollBankRows.toLocaleString("sv-SE")} rader · från {forecast.evidence.pollBankStartYear}</dd></div>
          <div><dt>SHA-256</dt><dd><code>{forecast.source.rawSha256}</code></dd></div>
          <div><dt>Källrevision</dt><dd><code>{forecast.source.upstreamCommit}</code></dd></div>
          <div><dt>Källadapter</dt><dd><code>{forecast.source.adapterVersion ?? "raw-v1"}</code></dd></div>
          <div><dt>Lottningar vid lika tal</dt><dd>{forecast.quality.seatTieLotSimulations.toLocaleString("sv-SE")} simuleringar · {pct(forecast.quality.seatTieLotRate)}</dd></div>
        </dl>
      </div>
      <div className="forecast-source-grid">
        <a href={forecast.source.repositoryUrl} target="_blank" rel="noreferrer"><span>POLL · CC0</span><strong>{forecast.source.dataset}</strong><small>Dataset och dokumentation ↗</small></a>
        {forecast.source.primaryCrossChecks.map((source) => (
          <a href={source.url} target="_blank" rel="noreferrer" key={source.url}><span>PRIMÄRKONTROLL · {date(source.publishedAt)}</span><strong>{source.publisher}</strong><small>Öppna publicerad mätning ↗</small></a>
        ))}
      </div>
      <div className="forecast-method__warnings">
        {forecast.source.publicationDateCorrections?.map((correction) => (
          <p key={`${correction.company}-${correction.fieldworkTo}`}>
            Källrättelse: {correction.company}, fältarbete {date(correction.fieldworkFrom)}–{date(correction.fieldworkTo)}.
            {" "}Publiceringsdatum används som {date(correction.publishedAt)} enligt <a href={correction.sourceUrl} target="_blank" rel="noreferrer">primärkällan ↗</a>,
            {" "}i stället för samlingsfilens {date(correction.originalPublishedAt)}. Originalfilen är bevarad.
          </p>
        ))}
        <strong>Begränsningar som följer med varje siffra</strong>
        <ul>
          <li>{forecast.quality.caveat}</li>
          <li>Övriga är en osäkerhetskategori som håller röstandelarna uttömmande, men den får inga mandat i v1. Ett nytt namngivet partis inträde modelleras alltså inte.</li>
          <li>Intervjusumman är inte unika personer; samma respondent kan förekomma i flera mätningar.</li>
          <li>Mätningar beskriver opinion vid fältarbetet. Kampanjhändelser efter datastoppet finns inte i prognosen.</li>
          <li>Regeringsalternativens mandat räknas av modellen. Partiernas villkor redovisas som daterad källkontext och får inga påhittade sannolikheter.</li>
          <li>Vid exakt lika jämförelsetal använder simuleringen en seedad, reproducerbar lottning. Frekvensen av val där en sådan lottning behövdes visas i registret.</li>
        </ul>
      </div>
    </div>
  )}</Localize>;
}
