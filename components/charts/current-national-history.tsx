"use client";
import { useLocale } from "../localize";
import { useLiveFeed } from "../live/use-live-feed";
import { currentNationalHistory } from "@/lib/live/national-history";
import { nationalHistory } from "@/lib/data/elections";
import { NationalTrendChart } from "./national-trend-chart";
import { DataSource } from "../data-source";
import { StaticSortableTable } from "../table-sort";
import { PartyMark } from "../party-mark";
import { PARTIES, PARTY_ORDER } from "@/lib/data/elections/parties";
import { translateText } from "@/lib/i18n/translate";

export function CurrentNationalHistory({ compact = false }: { compact?: boolean }) {
  const locale = useLocale(), sv = locale === "sv", { feed } = useLiveFeed();
  const history = currentNationalHistory(nationalHistory, feed), latest = history.elections.at(-1)!.year;
  const partyOrder = PARTY_ORDER.filter(id => id !== "OTHER");
  const f = (n: number) => n.toLocaleString(sv ? "sv-SE" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (compact) return <NationalTrendChart history={history} compact />;
  return <>
    <section className="interior-panel chart-page-panel">
      <div className="panel-heading"><div><span className="mini-label">PV / CHART 001</span><h2>{sv ? "Nationell röstandel" : "National vote share"}</h2><p>{sv ? "Fastställda riksdagsval" : "Final Riksdag results"}, 2002–{latest}</p></div><DataSource compact year={latest === 2026 ? 2026 : undefined} /></div>
      <NationalTrendChart history={history} />
    </section>
    <section className="interior-panel">
      <div className="panel-heading"><div><span className="mini-label">{sv ? "Underliggande värden" : "Underlying values"}</span><h2>{sv ? "Valdata i tabell" : "Election data table"}</h2><p>{sv ? "Andel av giltiga röster i hela landet, procent" : "Share of valid national votes, percent"}</p></div></div>
      <div className="data-table-wrap"><StaticSortableTable className="data-table" initial={{key:"year",direction:"descending"}} columns={[
        {key:"year",label:sv?"Val":"Election",name:sv?"Valår":"Year"},
        ...partyOrder.map(id=>({key:id,label:<PartyMark party={PARTIES[id]} size="sm"/>,name:translateText(PARTIES[id].name,locale)})),
        {key:"turnout",label:sv?"Valdeltagande":"Turnout",name:sv?"Valdeltagande":"Turnout"},
      ]} rows={history.elections.map(e=>({
        key:e.year, values:{year:e.year,turnout:e.turnout,...Object.fromEntries(partyOrder.map(id=>[id,e.parties.find(p=>p.partyId===id)?.share]))},
        content:<tr key={e.year}><th scope="row">{e.year}</th>{partyOrder.map(id=><td key={id}>{e.parties.find(p=>p.partyId===id) ? f(e.parties.find(p=>p.partyId===id)!.share) : "—"}</td>)}<td><strong>{f(e.turnout)}</strong></td></tr>,
      }))}/></div>
    </section>
  </>;
}
