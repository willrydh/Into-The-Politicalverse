import { getElection, getNationalRanking, getPartyChange } from "@/lib/data/elections";
import { PARTIES } from "@/lib/data/elections/parties";
import { formatDelta, formatNumber } from "@/lib/format";
import { PartyMark } from "@/components/party-mark";

export function NationalBaseline() {
  const election = getElection(2022);
  const ranking = getNationalRanking();

  return (
    <aside className="baseline-panel">
      <div className="baseline-panel__header">
        <div>
          <span className="mini-label">Latest official baseline</span>
          <h3>National result</h3>
        </div>
        <span className="year-chip">2022</span>
      </div>
      <div className="baseline-list">
        {ranking.map((result, index) => {
          const party = PARTIES[result.partyId];
          const change = getPartyChange(result.partyId);
          return (
            <div className="baseline-row" key={result.partyId}>
              <span className="baseline-row__rank">{String(index + 1).padStart(2, "0")}</span>
              <PartyMark party={party} size="sm" />
              <div className="baseline-row__bar-wrap">
                <div className="baseline-row__meta"><strong>{party.name}</strong><span>{result.share.toFixed(2)}%</span></div>
                <div className="baseline-row__bar"><span style={{ background: party.color, width: `${(result.share / 32) * 100}%` }} /></div>
              </div>
              <span className={change > 0 ? "delta delta--up" : change < 0 ? "delta delta--down" : "delta"}>{formatDelta(change)}</span>
            </div>
          );
        })}
      </div>
      <div className="baseline-panel__footer">
        <span><strong>{formatNumber(election.validVotes)}</strong> valid votes</span>
        <span>Change vs. 2018 in pp</span>
      </div>
    </aside>
  );
}
