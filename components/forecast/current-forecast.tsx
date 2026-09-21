"use client";
import { Localize, useLocale } from "../localize";
import { NowcastPanel } from "../live/nowcast";
import { useCurrentProjection } from "../live/use-live-feed";
import { projectedCoalitionSeats } from "@/lib/nowcast/current";
import { coalitionDefinitions } from "@/lib/forecast/coalitions";
import { GovernmentFormation } from "./government-formation";
import { isEstablishedResult, reportedGroupSeats } from "@/lib/live/headline-result";
import { CurrentElection } from "../live/current-election";
import { ForecastResultComparison } from "../live/forecast-comparison";

export function CurrentForecast({ compact = false }: { compact?: boolean }) {
  const { feed, delayed, estimate, probability, source } = useCurrentProjection();
  const sv = useLocale() === "sv", final = feed.results["final-count"];
  const official = final && isEstablishedResult(final) ? final : null;
  const coalitions = coalitionDefinitions.map(c => ({
    ...c,
    centralSeats: official ? reportedGroupSeats(official.national, c.partyIds) : projectedCoalitionSeats(estimate, c.partyIds),
    majorityProbability: probability && probability.unresolved < probability.simulations
      ? c.id === "opposition-four" ? probability.leftWins / probability.simulations
        : c.id === "tido-four" ? probability.rightWins / probability.simulations : null
      : null,
  }));
  return <>
    {official ? <><CurrentElection /><ForecastResultComparison result={official} /></> : <NowcastPanel feed={feed} delayed={delayed} />}
    <Localize><section className="forecast-government-section" id="regering" data-model-revision={source?.revision}>
      <div className="forecast-government-section__inner">
        <p className="eyebrow eyebrow--light">Mandat möter politik</p>
        <h2>Vem kan faktiskt bilda regering?</h2>
        <p className="forecast-section__lead">{official ? (sv ? "Mandatbaserna summerar det fastställda valresultatet. En matematisk majoritet betyder inte automatiskt att partierna bildar regering." : "Seat totals use the final election result. A mathematical majority does not automatically mean the parties will form a government.") : "Mandatbaserna summerar partiernas mandat i valnattens prognos. En matematisk majoritet betyder inte automatiskt att partierna bildar regering."}</p>
        <GovernmentFormation current={coalitions} established={!!official} compact={compact} />
      </div>
    </section></Localize>
  </>;
}
