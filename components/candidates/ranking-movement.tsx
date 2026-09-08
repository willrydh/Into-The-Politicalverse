"use client";

import { useLocale } from "../localize";
import type { CandidateComparison, RankingMetric } from "@/lib/candidates/types";
import { VoteDelta } from "./shared";

/** The mobile row highlights the selected comparison, with its unit intact. */
export function RankingMovement({ comparison, metric }: { comparison: CandidateComparison; metric: RankingMetric }) {
  const sv = useLocale() === "sv";
  const share = metric === "sharePoints", delta = metric === "delta";
  const value = share ? comparison.sharePoints : comparison.delta;
  const label = share ? (sv ? "Andelslyft" : "Share gain") : delta ? (sv ? "Nya röster" : "Votes gained") : (sv ? "Röstförändring" : "Vote change");
  return <span className="candidate-ranking-movement" data-classification="DERIVED">
    <small>{label}</small>
    {share || delta ? <span className={`vote-delta ${value === null ? "is-missing" : value > 0 ? "is-up" : value < 0 ? "is-down" : "is-flat"}`}>
      <strong>{value === null ? "—" : `${value > 0 ? "↑ +" : value < 0 ? "↓ −" : ""}${Math.abs(value).toLocaleString(sv ? "sv-SE" : "en-GB", { minimumFractionDigits: share ? 2 : 0, maximumFractionDigits: share ? 2 : 0 })}${share ? " pp" : ""}`}</strong>
    </span> : <VoteDelta comparison={comparison} compact/>}
  </span>;
}
