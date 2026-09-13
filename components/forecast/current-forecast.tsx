"use client";
import { Localize } from "../localize";
import { NowcastPanel } from "../live/nowcast";
import { useCurrentProjection } from "../live/use-live-feed";
import { projectedCoalitionSeats } from "@/lib/nowcast/current";
import { coalitionDefinitions } from "@/lib/forecast/coalitions";
import { GovernmentFormation } from "./government-formation";

export function CurrentForecast({ compact = false }: { compact?: boolean }) {
  const { feed, delayed, estimate, probability, source } = useCurrentProjection();
  const coalitions = coalitionDefinitions.map(c => ({
    ...c,
    centralSeats: projectedCoalitionSeats(estimate, c.partyIds),
    majorityProbability: probability && probability.unresolved < probability.simulations
      ? c.id === "opposition-four" ? probability.leftWins / probability.simulations
        : c.id === "tido-four" ? probability.rightWins / probability.simulations : null
      : null,
  }));
  return <>
    <NowcastPanel feed={feed} delayed={delayed} />
    <Localize><section className="forecast-government-section" id="regering" data-model-revision={source?.revision}>
      <div className="forecast-government-section__inner">
        <p className="eyebrow eyebrow--light">Mandat möter politik</p>
        <h2>Vem kan faktiskt bilda regering?</h2>
        <p className="forecast-section__lead">Mandatbaserna summerar partiernas mandat i valnattens prognos. En matematisk majoritet betyder inte automatiskt att partierna bildar regering.</p>
        <GovernmentFormation current={coalitions} compact={compact} />
      </div>
    </section></Localize>
  </>;
}
