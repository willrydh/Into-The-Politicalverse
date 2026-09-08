"use client";

import { useLocale } from "../localize";
import type { BallotPosition } from "@/lib/candidates/types";
import { summarizeBallotPositions } from "@/lib/candidates/ballots";

export function CandidateBallotPositions({ ballots, year }: { ballots: BallotPosition[]; year: number }) {
  const sv = useLocale() === "sv";
  const { positions, lists } = summarizeBallotPositions(ballots);
  if (!positions.length) return <span className="candidate-ballot-missing">{sv ? "Listplats saknas" : "List position unavailable"}</span>;
  const label = `${sv ? positions.length === 1 ? "Listplats" : "Listplatser" : positions.length === 1 ? "List position" : "List positions"} ${positions.slice(0, 3).join(", ")}${positions.length > 3 ? ` +${positions.length - 3}` : ""}`;
  return <details className="candidate-ballot-positions" data-classification="OFFICIAL">
    <summary aria-label={`${label} · ${year} · ${sv ? "Visa valsedlar" : "Show ballot lists"}`}>
      <span>{label}{lists > 1 && <span className="candidate-ballot-count">{lists} {sv ? "valsedlar" : "ballot lists"}</span>}</span>
    </summary>
    <div className="candidate-ballot-detail">
      <p>{sv ? `Slutresultatets valsedlar, ${year}` : `Ballot lists in the final results, ${year}`}</p>
      <ul>{ballots.map(b => <li key={`${b.listNumber}:${b.position}`}><span>{b.listNumber}</span><span>{sv ? "Plats" : "Position"} {b.position}</span></li>)}</ul>
      <p>Valmyndigheten · {sv ? "Slutresultat" : "Final results"}</p>
    </div>
  </details>;
}
