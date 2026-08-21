import Link from "next/link";
import { PartyMark } from "@/components/party-mark";
import { PARTY_ORDER, PARTIES } from "@/lib/parties";
import type { ElectionForecast } from "@/lib/forecast/types";
import type { SimulatorPartyId } from "@/lib/simulator/types";

function probability(value: number): string {
  if (value >= 0.9995) return ">99,9 %";
  return `${(value * 100).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} %`;
}

function signed(value: number): string {
  if (value === 0) return "oförändrat";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("sv-SE", { maximumFractionDigits: 2 })}`;
}

export function ForecastHero({ forecast }: { forecast: ElectionForecast }) {
  const mainQuestion = forecast.questions.find((question) => question.id === "opposition-majority")!;
  const previous = forecast.trend.at(-2) ?? forecast.trend.at(-1)!;
  const change = forecast.centralScenario.changeSincePreviousDataPoint;
  const movers = PARTY_ORDER.filter((partyId): partyId is SimulatorPartyId => partyId !== "OTHER")
    .map((partyId) => ({ partyId, change: forecast.pollingAverage[partyId] - previous.partyShares[partyId] }))
    .sort((left, right) => Math.abs(right.change) - Math.abs(left.change));

  return (
    <section className="forecast-hero">
      <div className="forecast-hero__grid">
        <div className="forecast-hero__copy">
          <p className="eyebrow eyebrow--light"><span /> Politicalverse forecast · 2026</p>
          <h1>Så tror modellen<br />att valet <em>slutar.</em></h1>
          <p className="forecast-hero__deck">
            Opinionsmätningar, fyra jämförbara historiska val och Sveriges riktiga mandatregler — sammanvägt till en prognos som visar både utfall och osäkerhet.
          </p>
          <div className="forecast-hero__meta">
            <span className="model-badge">MODEL · BETA</span>
            <span>Datastopp {new Date(`${forecast.model.dataCutoff}T12:00:00Z`).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}</span>
            <span>{forecast.model.simulations.toLocaleString("sv-SE")} simulerade val</span>
          </div>
        </div>

        <article className="forecast-call">
          <div className="forecast-call__top"><span>HUVUDPROGNOS</span><span>PV/F01</span></div>
          <p>{mainQuestion.question}</p>
          <strong>{probability(mainQuestion.probability)}</strong>
          <div
            className="forecast-probability-track"
            role="progressbar"
            aria-label={mainQuestion.question}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(mainQuestion.probability * 100)}
          ><span style={{ width: `${mainQuestion.probability * 100}%` }} /></div>
          <div className="forecast-call__labels"><span>NEJ</span><span>JA</span></div>
          <details>
            <summary>Vad betyder sannolikheten?</summary>
            <p>{mainQuestion.explanation} {mainQuestion.resolution}</p>
          </details>
        </article>
      </div>

      <div className="mandate-board" aria-label="Central mandate forecast">
        <div className="mandate-board__headline">
          <div><span>S · V · MP · C</span><strong>{forecast.centralScenario.oppositionSeats}</strong><small>mandat i centralprognosen</small></div>
          <div className="mandate-board__majority"><span>Majoritet</span><b>175</b></div>
          <div><span>M · SD · KD · L</span><strong>{forecast.centralScenario.tidoSeats}</strong><small>mandat i centralprognosen</small></div>
        </div>
        <div className="mandate-bar">
          {PARTY_ORDER.filter((partyId): partyId is SimulatorPartyId => partyId !== "OTHER")
            .sort((left, right) => forecast.centralScenario.seats[right] - forecast.centralScenario.seats[left])
            .map((partyId) => (
              <span
                key={partyId}
                style={{ width: `${(forecast.centralScenario.seats[partyId] / 349) * 100}%`, background: PARTIES[partyId].color }}
                title={`${PARTIES[partyId].name}: ${forecast.centralScenario.seats[partyId]} mandat`}
              />
            ))}
        </div>
        <div className="mandate-legend">
          {PARTY_ORDER.filter((partyId): partyId is SimulatorPartyId => partyId !== "OTHER").map((partyId) => (
            <div key={partyId}><PartyMark party={PARTIES[partyId]} size="sm" /><span>{partyId}</span><strong>{forecast.centralScenario.seats[partyId]}</strong></div>
          ))}
        </div>
        <footer className="mandate-board__update">
          <p><span className="model-badge">MODEL</span> Senaste datapunkt {forecast.model.dataCutoff}</p>
          <p>
            Sedan föregående datapunkt {change.date}: mandatbas {change.oppositionSeatDelta > 0 ? "+" : ""}{change.oppositionSeatDelta} / {change.tidoSeatDelta > 0 ? "+" : ""}{change.tidoSeatDelta}
            <span className="mandate-board__movers"> · {movers.slice(0, 3).map(({ partyId, change: partyChange }) => `${partyId} ${signed(partyChange)}`).join(" · ")}</span>
          </p>
          <Link href="/forecasts">Öppna hela prognosen <span>→</span></Link>
        </footer>
      </div>
    </section>
  );
}
