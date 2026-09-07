import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import { StaticSortableTable } from "@/components/table-sort";
import { translateText } from "@/lib/i18n/translate";
import { DataSource } from "@/components/data-source";
import { PartyMark } from "@/components/party-mark";
import { NationalTrendChart } from "@/components/charts/national-trend-chart";
import { nationalHistory } from "@/lib/data/elections";
import { PARTIES, PARTY_ORDER } from "@/lib/data/elections/parties";

export const metadata: Metadata = { title: "Grafer" };

export default function ChartsPage({ locale = "sv" }: { locale?: Locale } = {}) {
  const partyOrder = PARTY_ORDER.filter((partyId) => partyId !== "OTHER");

  return localizeNode((
    <div className="interior-page">
      <header className="interior-hero interior-hero--chart">
        <div><p className="eyebrow eyebrow--light">Charts · National series</p><h1>The chart is<br /><em>the product.</em></h1></div>
        <div className="interior-hero__aside"><strong>6</strong><span>general elections</span><strong>8</strong><span>parliamentary parties</span><strong>48</strong><span>charted data points</span></div>
      </header>
      <section className="interior-panel chart-page-panel">
        <div className="panel-heading"><div><span className="mini-label">PV / CHART 001</span><h2>National vote share</h2><p>Final Riksdag results, 2002–2022</p></div><DataSource compact /></div>
        <NationalTrendChart history={nationalHistory} />
      </section>
      <section className="interior-panel">
        <div className="panel-heading"><div><span className="mini-label">Underlying values</span><h2>Election data table</h2><p>Share of valid national votes, percent</p></div></div>
        <div className="data-table-wrap">
          <StaticSortableTable className="data-table" initial={{key:"year",direction:"ascending"}} columns={[
            {key:"year",label:locale==="sv"?"Val":"Election",name:locale==="sv"?"Valår":"Year"},
            ...partyOrder.map(id=>({key:id,label:<PartyMark party={PARTIES[id]} size="sm"/>,name:translateText(PARTIES[id].name,locale)})),
            {key:"turnout",label:locale==="sv"?"Valdeltagande":"Turnout",name:locale==="sv"?"Valdeltagande":"Turnout"},
          ]} rows={nationalHistory.elections.map(election=>({
            key:election.year,
            values:{year:election.year,turnout:election.turnout,...Object.fromEntries(partyOrder.map(id=>[id,election.parties.find(p=>p.partyId===id)?.share]))},
            content:<tr key={election.year}><th scope="row">{election.year}</th>{partyOrder.map(id=><td key={id}>{election.parties.find(p=>p.partyId===id)?.share.toFixed(2)??"—"}</td>)}<td><strong>{election.turnout.toFixed(2)}</strong></td></tr>,
          }))}/>

        </div>
      </section>
    </div>
  ), locale);
}
