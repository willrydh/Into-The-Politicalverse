import type { Metadata } from "next";
import { DataSource } from "@/components/data-source";
import { PartyMark } from "@/components/party-mark";
import { nationalHistory } from "@/lib/data/elections";
import { PARTIES } from "@/lib/data/elections/parties";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Elections" };

export default function ElectionsPage() {
  return (
    <div className="interior-page">
      <header className="interior-hero interior-hero--elections">
        <div><p className="eyebrow eyebrow--light">Election archive · Sweden</p><h1>Six elections.<br /><em>One record.</em></h1></div>
        <div className="interior-hero__context"><p className="interior-hero__deck">A comparable national baseline from the final count in every Swedish general election since 2002.</p><DataSource compact /></div>
      </header>
      <section className="election-list">
        {[...nationalHistory.elections].reverse().map((election, index) => {
          const winner = [...election.parties].sort((a, b) => b.share - a.share)[0];
          const party = PARTIES[winner.partyId];
          return (
            <article className="election-row" key={election.year}>
              <div className="election-row__year"><span>{String(index + 1).padStart(2, "0")}</span><strong>{election.year}</strong><small>{new Date(`${election.electionDate}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</small></div>
              <div className="election-row__winner"><span className="mini-label">Largest party</span><div><PartyMark party={party} size="sm" /><strong>{party.name}</strong><b>{winner.share.toFixed(2)}%</b></div></div>
              <div className="election-row__metric"><span>Valid votes</span><strong>{formatNumber(election.validVotes)}</strong></div>
              <div className="election-row__metric"><span>Turnout</span><strong>{election.turnout.toFixed(2)}%</strong></div>
              <div className="election-row__bar"><span style={{ width: `${election.turnout}%` }} /></div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
