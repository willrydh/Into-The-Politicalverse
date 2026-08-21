import type { Metadata } from "next";
import { DataSource } from "@/components/data-source";
import { NationalTrendChart } from "@/components/charts/national-trend-chart";
import { nationalHistory } from "@/lib/data/elections";
import { PARTIES, PARTY_ORDER } from "@/lib/data/elections/parties";

export const metadata: Metadata = { title: "Charts" };

export default function ChartsPage() {
  const partyOrder = PARTY_ORDER.filter((partyId) => partyId !== "OTHER");

  return (
    <div className="interior-page">
      <header className="interior-hero interior-hero--chart">
        <div><p className="eyebrow eyebrow--light">Charts · National series</p><h1>The chart is<br /><em>the product.</em></h1></div>
        <div className="interior-hero__aside"><strong>5</strong><span>general elections</span><strong>8</strong><span>parliamentary parties</span><strong>40</strong><span>charted data points</span></div>
      </header>
      <section className="interior-panel chart-page-panel">
        <div className="panel-heading"><div><span className="mini-label">PV / CHART 001</span><h2>National vote share</h2><p>Final Riksdag results, 2006–2022</p></div><DataSource compact /></div>
        <NationalTrendChart history={nationalHistory} />
      </section>
      <section className="interior-panel">
        <div className="panel-heading"><div><span className="mini-label">Underlying values</span><h2>Election data table</h2><p>Share of valid national votes, percent</p></div></div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Election</th>{partyOrder.map((id) => <th key={id}><span style={{ background: PARTIES[id].color }} />{id}</th>)}<th>Turnout</th></tr></thead>
            <tbody>
              {nationalHistory.elections.map((election) => (
                <tr key={election.year}>
                  <th>{election.year}</th>
                  {partyOrder.map((id) => <td key={id}>{election.parties.find((party) => party.partyId === id)?.share.toFixed(2)}</td>)}
                  <td><strong>{election.turnout.toFixed(2)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
