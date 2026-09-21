"use client";
import { useState } from "react";
import { useLocale } from "../localize";
import { useAreaFeed } from "./use-area-feed";
import { LiveResultTable } from "./result-table";
import { navigateLocalQuery, useLocalQuery } from "../maps/local-url";
import { usePublishSiteLocation } from "../site-location";
import { areaIsEstablished, areaKey, selectAreaResult, type CountedArea, type ElectionType } from "@/lib/live/area-types";
import { aggregateMunicipalVotes } from "@/lib/live/area-aggregate";
import type { CountingStage } from "@/lib/live/types";
import type { LocalIndexModel } from "@/lib/data/geography/local-types";
import { SortHeaders, useTableSort } from "../table-sort";
import { LocalPersonalVotes } from "../maps/local-personal-votes";
import { PARTIES } from "@/lib/parties";
import { PARTY_IDS, type PartyId } from "@/lib/data/elections/types";
import Link from "next/link";
import { translateText } from "@/lib/i18n/translate";

type Geography = Pick<LocalIndexModel, "counties" | "municipalities" | "national" | "constituencies">;

function AreaDirectory({ areas, select }: { areas: CountedArea[]; select: (code: string) => void }) {
  const sv = useLocale() === "sv", language = sv ? "sv-SE" : "en-GB";
  const [search, setSearch] = useState(""), [page, setPage] = useState(0);
  const table = useTableSort(areas.filter(a => a.name.toLocaleLowerCase(language).includes(search.toLocaleLowerCase(language))), [
    { key: "name", label: sv ? "Kommun" : "Municipality", name: sv ? "Kommun" : "Municipality", direction: "ascending", value: a => a.name },
    { key: "votes", label: sv ? "Röster" : "Votes", name: sv ? "Röster" : "Votes", value: a => a.validVotes },
    { key: "counted", label: sv ? "Distrikt" : "Districts", name: sv ? "Distrikt" : "Districts", value: a => a.totalDistricts > 0 ? a.countedDistricts / a.totalDistricts : null },
  ], { key: "name", direction: "ascending" });
  const pages = Math.max(1, Math.ceil(table.rows.length / 30)), selectedPage = Math.min(page, pages - 1);
  return <section className="area-directory"><h3>{sv ? "Kommunerna" : "Municipalities"}</h3><label className="area-search">{sv ? "Sök kommun" : "Find a municipality"}<input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label>
    <div className="live-table live-table--votes" role="table" aria-label={sv ? "Kommunernas rapporterade resultat" : "Reported municipal results"}>
      <div role="row" className="live-table__head" onClick={() => setPage(0)}><SortHeaders as="span" control={table} /></div>
      {table.rows.slice(selectedPage * 30, (selectedPage + 1) * 30).map(a => <div role="row" key={a.code}><span role="cell"><button type="button" className="area-link" onClick={() => select(a.code)}>{a.name} →</button></span><span role="cell">{a.validVotes.toLocaleString(language)}</span><span role="cell">{a.countedDistricts}/{a.totalDistricts}</span></div>)}
    </div>{pages > 1 && <div className="area-pagination"><button type="button" disabled={selectedPage === 0} onClick={() => setPage(selectedPage - 1)}>{sv ? "Föregående" : "Previous"}</button><span>{selectedPage + 1} / {pages}</span><button type="button" disabled={selectedPage + 1 === pages} onClick={() => setPage(selectedPage + 1)}>{sv ? "Nästa" : "Next"}</button></div>}
  </section>;
}

export function AreaResults({ geography }: { geography: Geography }) {
  const locale = useLocale(), sv = locale === "sv", language = sv ? "sv-SE" : "en-GB";
  const query = useLocalQuery(), params = new URLSearchParams(query);
  const state = useAreaFeed(), feed = state.feed;
  const election = params.get("election"), type: ElectionType = election === "RF" || election === "KF" ? election : "RD";
  const municipality = geography.municipalities.find(m => m.code === params.get("municipality"));
  const county = geography.counties.find(c => c.code === (municipality?.parent ?? params.get("county")));
  const requestedStage = params.get("stage"), stage = requestedStage === "preliminary" || requestedStage === "final-count" ? requestedStage as CountingStage : undefined;
  const change = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(query); next.set("year", "2026");
    if ("county" in values || "municipality" in values) next.delete("constituency");
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value); else next.delete(key);
    navigateLocalQuery(`?${next}`);
  };
  const result = feed ? selectAreaResult(feed, type, type === "RD" ? "00" : type === "RF" ? county?.code ?? "" : municipality?.code ?? "", stage) : null;
  let area: CountedArea | null = result?.area ?? null;
  const underlying = result?.municipalities.filter(m => !county || m.countyCode === county.code) ?? [];
  if (result && type !== "KF" && municipality) area = result.municipalities.find(m => m.code === municipality.code) ?? null;
  else if (result && type === "RD" && county) area = underlying.length ? aggregateMunicipalVotes(underlying, county.code, county.name) : null;
  const mandates = type === "KF" || (!municipality && (type === "RF" || !county));
  const directory = type === "KF" && !municipality && feed ? geography.municipalities.filter(m => !county || m.parent === county.code).flatMap(m => { const r = selectAreaResult(feed, "KF", m.code, stage); return r ? [r.area] : []; }) : !municipality ? underlying : [];
  const selectedError = feed?.failures.includes("index") || (result && feed?.failures.includes(areaKey(type, result.area.code, result.stage)));
  const established = result ? areaIsEstablished(result) : false;
  const f = (n: number, digits = 0) => n.toLocaleString(language, { maximumFractionDigits: digits });
  const date = (v: string) => new Date(v).toLocaleString(language, { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const names = sv ? { RD: "Riksdagen", RF: "Regionfullmäktige", KF: "Kommunfullmäktige" } : { RD: "Riksdag", RF: "Regional council", KF: "Municipal council" };
  const prefix = sv ? "" : "/en";
  const party = PARTY_IDS.includes(params.get("party") as PartyId) ? params.get("party") as PartyId : "S";
  usePublishSiteLocation("/maps", query, [{ label: "2026", href: `${prefix}/maps/?year=2026` }, ...(county ? [{ label: county.name, href: `${prefix}/maps/?year=2026&election=${type}&county=${county.code}` }] : []), ...(municipality ? [{ label: municipality.name, href: `${prefix}/maps/${query}` }] : [])]);
  return <div className="area-results" data-classification={type === "RD" && county && !municipality ? "DERIVED" : "OFFICIAL"}>
    <div className="area-controls">
      <label>{sv ? "Val" : "Election"}<select value={type} onChange={e => change({ election: e.target.value })}>{Object.entries(names).map(([value, label]) => <option key={value} value={value}>{value === "RF" ? (sv ? "Region" : "Region") : value === "KF" ? (sv ? "Kommun" : "Municipality") : label}</option>)}</select></label>
      <label>{sv ? "Län" : "County"}<select value={county?.code ?? ""} onChange={e => change({ county: e.target.value, municipality: null })}><option value="">{sv ? "Hela Sverige" : "All of Sweden"}</option>{geography.counties.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
      <label>{sv ? "Kommun" : "Municipality"}<select value={municipality?.code ?? ""} onChange={e => change({ municipality: e.target.value })}><option value="">{sv ? "Alla kommuner" : "All municipalities"}</option>{geography.municipalities.filter(m => !county || m.parent === county.code).map(m => <option key={m.code} value={m.code}>{m.name}</option>)}</select></label>
      <label>{sv ? "Rösträkning" : "Counting stage"}<select value={stage ?? "auto"} onChange={e => change({ stage: e.target.value === "auto" ? null : e.target.value })}><option value="auto">{sv ? "Samlad resultatbild" : "Overall result"}</option><option value="preliminary">{sv ? "Preliminär räkning" : "Preliminary count"}</option><option value="final-count">{sv ? "Slutlig räkning" : "Final count"}</option></select></label>
    </div>
    {!feed && <p role="status">{state.connectionError ? (sv ? "Resultaten kunde inte hämtas." : "Results could not be loaded.") : (sv ? "Hämtar verifierade valresultat…" : "Loading verified election results…")}{state.connectionError && <button type="button" onClick={() => void state.retry()}>{sv ? "Försök igen" : "Retry"}</button>}</p>}
    {feed && <>
      <div className="panel-heading"><div><span className="mini-label">2026 · {names[type]}</span><h2>{area?.name ?? county?.name ?? (sv ? "Hela Sverige" : "All of Sweden")}</h2><p role="status">{established ? (sv ? "Fastställt valresultat" : "Final election result") : (result?.stage ?? stage) === "final-count" ? (sv ? "Slutlig rösträkning · ej fastställt" : "Final count · not yet established") : (sv ? "Preliminär rösträkning" : "Preliminary count")}{(state.delayed || selectedError) && ` · ${sv ? "Uppdatering fördröjd" : "Update delayed"}`}</p></div></div>
      {area && result ? <>
        <dl className="area-facts"><div><dt>{sv ? "Rapporterade distrikt" : "Reported districts"}</dt><dd>{f(area.countedDistricts)} / {f(area.totalDistricts)}</dd></div><div><dt>{sv ? "Giltiga röster" : "Valid votes"}</dt><dd>{f(area.validVotes)}</dd></div><div><dt>{sv ? "Deltagande¹" : "Turnout¹"}</dt><dd>{area.turnoutInCountedDistricts === null ? "—" : `${f(area.turnoutInCountedDistricts, 2)} %`}</dd></div></dl>
        <LiveResultTable key={`${type}/${area.code}/${result.stage}`} area={area} compact mandates={mandates} />
        <p className="local-note">{sv ? "¹ Deltagande i rapporterade distrikt. Källan uppdaterad" : "¹ Turnout in reported districts. Source updated"} {date(result.sourceUpdatedAt)} ({sv ? "svensk tid" : "Swedish time"}). {!mandates && (sv ? "Röster i valt område; mandat fördelas på valområdesnivå." : "Votes in the selected area; seats are allocated at electoral-area level.")}</p>
        {result.protocolUrl && <a href={result.protocolUrl} target="_blank" rel="noreferrer">{sv ? "Officiellt protokoll" : "Official protocol"} ↗</a>}
      </> : <p>{stage === "final-count" ? (sv ? "Ingen verifierad slutlig räkning finns ännu för urvalet." : "No verified final count is available for this selection yet.") : type === "RF" && county?.code === "09" ? (sv ? "Gotland har inget separat regionval. Välj kommunfullmäktige för Region Gotland." : "Gotland has no separate regional election. Select Municipal council for Region Gotland.") : type === "RF" && !county ? (sv ? "Välj län för att se regionvalets röster och mandat." : "Choose a county to see regional votes and seats.") : type === "KF" && !municipality ? (sv ? "Välj kommun nedan för röster, mandat och jämförelse med 2022." : "Choose a municipality below for votes, seats and comparison with 2022.") : (sv ? "Inväntar verifierat resultat för urvalet." : "Waiting for a verified result for this selection.")}</p>}
      {type === "RD" ? <>
        <label className="area-search">{sv ? "Parti för personröster" : "Party for personal votes"}<select value={party} onChange={e => change({party:e.target.value})}>{PARTY_IDS.map(id => <option key={id} value={id}>{translateText(PARTIES[id].name,locale)}</option>)}</select></label>
        <LocalPersonalVotes key={`${county?.code}/${municipality?.code}`} area={municipality ?? county ?? geography.national} county={county} municipality={municipality} constituencies={geography.constituencies} selection={{year:2026,party,metric:"share",county:county?.code ?? "",municipality:municipality?.code ?? "",district:"",constituency:params.get("constituency") ?? ""}} onConstituency={code => change({constituency:code})}/>
      </> : <p><Link href={`${prefix}/rankings/?year=2026&election=${type}${county ? `&county=${county.code}` : ""}${municipality && type === "KF" ? `&area=${municipality.code}` : ""}`}>{sv ? "Personröster och topplistor 2026" : "2026 personal votes and leaderboards"} →</Link></p>}
      {directory.length > 0 && <AreaDirectory key={`${type}/${county?.code}/${stage}`} areas={directory} select={code => change({ municipality: code })} />}
      <footer className="area-source"><p>{sv ? "Kontrollerad" : "Checked"} {date(feed.checkedAt)} · {sv ? "svensk tid" : "Swedish time"}. {feed.published.preliminary.RF}/20 {sv ? "regionval" : "regional elections"}, {feed.published.preliminary.KF}/290 {sv ? "kommunval publicerade" : "municipal elections published"}.</p><p>{sv ? "Sena förtids- och utlandsröster ingår när de rapporteras. Räkningstillfällena summeras aldrig. Samlad resultatbild visar preliminär räkning tills den slutliga täcker hela valområdet. Fastställda personröster införs val för val i profiler och topplistor." : "Late advance and overseas votes are included when reported. Counting stages are never added together. Overall result retains the preliminary count until the final count covers the whole electoral area. Final personal votes are added to profiles and leaderboards as each election is established."}</p><a href="https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026" target="_blank" rel="noreferrer">{sv ? "Valmyndighetens källor" : "Election authority sources"} ↗</a></footer>
    </>}
  </div>;
}
