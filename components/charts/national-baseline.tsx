"use client";
import { Localize, useLocale } from "@/components/localize";
import { nationalHistory } from "@/lib/data/elections";
import { currentNationalHistory } from "@/lib/live/national-history";
import { useLiveFeed } from "../live/use-live-feed";
import { PARTIES } from "@/lib/data/elections/parties";
import { formatDelta, formatNumber } from "@/lib/format";
import { PartyMark } from "@/components/party-mark";

export function NationalBaseline() {
  const sv = useLocale() === "sv", { feed } = useLiveFeed();
  const history = currentNationalHistory(nationalHistory, feed);
  const election = history.elections.at(-1)!, previous = history.elections.at(-2)!;
  const ranking = [...election.parties].sort((a, b) => b.votes - a.votes);

  return <Localize>{(
    <aside className="baseline-panel">
      <div className="baseline-panel__header">
        <div>
          <span className="mini-label">Latest official baseline</span>
          <h3>National result</h3>
        </div>
        <span className="year-chip">{election.year}</span>
      </div>
      <div className="baseline-list">
        {ranking.map((result, index) => {
          const party = PARTIES[result.partyId];
          const baseline = previous.parties.find(p => p.partyId === result.partyId);
          const change = baseline ? result.share - baseline.share : null;
          return (
            <div className="baseline-row" key={result.partyId}>
              <span className="baseline-row__rank">{String(index + 1).padStart(2, "0")}</span>
              {party.logo ? <PartyMark party={party} size="sm" /> : <span aria-hidden="true"/>}
              <div className="baseline-row__bar-wrap">
                <div className="baseline-row__meta"><strong>{party.name}</strong><span>{result.share.toFixed(2)}%</span></div>
                <div className="baseline-row__bar"><span style={{ background: party.color, width: `${(result.share / 32) * 100}%` }} /></div>
              </div>
              <span className={change !== null && change > 0 ? "delta delta--up" : change !== null && change < 0 ? "delta delta--down" : "delta"}>{change === null ? "—" : formatDelta(change)}</span>
            </div>
          );
        })}
      </div>
      <div className="baseline-panel__footer">
        <span><strong>{formatNumber(election.validVotes)}</strong> valid votes</span>
        <span>{sv ? "Förändring mot" : "Change vs."} {previous.year} {sv ? "i pp" : "in pp"}</span>
      </div>
    </aside>
  )}</Localize>;
}
