"use client";
import { PartyText } from "@/components/party-label";
import { Localize } from "@/components/localize";
import Link from "next/link";
import type { ElectionForecast, ForecastQuestion } from "@/lib/forecast/types";
import { ForecastSparkline } from "./forecast-sparkline";

function probability(value: number): string {
  if (value >= 0.9995) return ">99,9";
  if (value <= 0.0005) return "<0,1";
  return (value * 100).toLocaleString("sv-SE", { maximumFractionDigits: 1 });
}

function valuesForQuestion(question: ForecastQuestion, forecast: ElectionForecast): { values: number[]; threshold?: number } {
  if (question.id === "opposition-majority") return { values: forecast.trend.map((point) => point.oppositionSeats), threshold: 175 };
  if (question.id === "tido-majority") return { values: forecast.trend.map((point) => point.tidoSeats), threshold: 175 };
  if (question.id === "liberals-threshold") return { values: forecast.trend.map((point) => point.partyShares.L), threshold: 4 };
  if (question.id === "christian-democrats-threshold") return { values: forecast.trend.map((point) => point.partyShares.KD), threshold: 4 };
  if (question.id === "social-democrats-largest") {
    return {
      values: forecast.trend.map((point) => point.partyShares.S - Math.max(
        point.partyShares.SD,
        point.partyShares.M,
        point.partyShares.V,
        point.partyShares.C,
        point.partyShares.KD,
        point.partyShares.MP,
        point.partyShares.L,
      )),
      threshold: 0,
    };
  }
  if (question.id === "sd-beats-m") return { values: forecast.trend.map((point) => point.partyShares.SD - point.partyShares.M), threshold: 0 };
  if (question.id === "seven-parties") return { values: forecast.trend.map((point) => Object.values(point.partyShares).filter((share) => share >= 4).length), threshold: 7 };
  throw new Error(`Forecast question ${question.id} has no trend series.`);
}

export function PredictionGrid({ forecast, limit }: { forecast: ElectionForecast; limit?: number }) {
  const questions = limit ? forecast.questions.slice(0, limit) : forecast.questions;
  return <Localize>{(
    <div className="prediction-grid">
      {questions.map((question, index) => {
        const series = valuesForQuestion(question, forecast);
        return (
          <article className="prediction-card" id={question.id} key={question.id}>
            <header><span>PV/F{String(index + 1).padStart(2, "0")}</span><b>MODEL</b></header>
            <h3><PartyText>{question.question}</PartyText></h3>
            <div className="prediction-card__signal">
              <strong>{probability(question.probability)}<small>%</small></strong>
              <ForecastSparkline values={series.values} threshold={series.threshold} label={`Historisk modellrörelse för ${question.resultLabel}`} />
            </div>
            <div
              className="prediction-card__bar"
              role="progressbar"
              aria-label={`${probability(question.probability)} procents modellsannolikhet`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(question.probability * 100)}
            ><span style={{ width: `${question.probability * 100}%` }} /></div>
            <p><PartyText>{question.explanation}</PartyText></p>
            <details><summary>Definition och osäkerhet</summary><p><PartyText>{question.resolution}</PartyText> Prognosen är en modell, inte ett marknadspris eller ett löfte.</p></details>
          </article>
        );
      })}
      {limit ? <Link className="prediction-card prediction-card--more" href="/forecasts"><span>Se alla prognosfrågor</span><strong>→</strong></Link> : null}
    </div>
  )}</Localize>;
}
