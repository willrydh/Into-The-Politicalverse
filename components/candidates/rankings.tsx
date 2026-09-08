"use client";
import { useMemo, useState } from "react";
import { MobileTableSort, SortHeaders, useTableSort, type SortColumn } from "../table-sort";
import Link from "next/link";
import { useLocale } from "../localize";
import { localizedHref } from "@/lib/i18n/translate";
import { useLocalQuery, navigateLocalQuery } from "../maps/local-url";
import { usePublishSiteLocation } from "../site-location";
import { CANDIDATE_YEARS, ELECTION_TYPES, personHref, type CandidateYear, type CandidateElection, type RankingMetric } from "@/lib/candidates/types";
import { validateCatalog, validateRankings } from "@/lib/candidates/validation";
import { rankCandidates } from "@/lib/candidates/math";
import { CandidateLoading, CandidateMethod, electionLabel, partyLabel, CandidateParty, useCandidateResource, VoteDelta } from "./shared";
import { normalizeSearch } from "@/lib/search/engine";
import { CandidateBallotPositions } from "./ballot-positions";

export function CandidateRankings() {
  const locale = useLocale(), sv = locale === "sv", query = useLocalQuery(), p = new URLSearchParams(query);
  const year = CANDIDATE_YEARS.includes(Number(p.get("year")) as CandidateYear) ? Number(p.get("year")) as CandidateYear : 2022;
  const election = ELECTION_TYPES.includes(p.get("election") as CandidateElection) ? p.get("election") as CandidateElection : "KF";
  const metric = (["percent","delta","votes","sharePoints"] as const).includes(p.get("metric") as RankingMetric) ? String(p.get("metric")) as RankingMetric : "percent";
  const county=String(p.get("county")??""), area=String(p.get("area")??""), party=String(p.get("party")??""), minimum=[0,1,10,50,100].includes(Number(p.get("minimum"))) && p.has("minimum") ? Number(p.get("minimum")) : 1;
  const [search,setSearch]=useState("");
  const tableContext = JSON.stringify([year,election,metric,county,area,party,minimum,search]);
  const [pagination,setPagination]=useState({context:tableContext,page:0});
  if(pagination.context!==tableContext) setPagination({context:tableContext,page:0});
  const page=pagination.context===tableContext?pagination.page:0;
  function setPage(nextPage:number) { setPagination({context:tableContext,page:nextPage}); }
  const catalogState = useCandidateResource("index.json",validateCatalog), state=useCandidateResource(`rankings/${year}-${election}.json`,validateRankings), catalog=catalogState.data;
  const data=state.data?.year===year && state.data.electionType===election ? state.data : undefined;
  function update(values: Record<string,string>) { const next=new URLSearchParams(query);for(const [key,value]of Object.entries(values)){if(value)next.set(key,value);else next.delete(key);} navigateLocalQuery(`?${next}`);setPage(0); }
  const localRows = useMemo(()=>data?.rows.filter(r=>(!county||r.county===county)&&(!area||r.areaCode===area))??[],[data,county,area]);
  const parties=useMemo(()=>[...new Map(localRows.map(r=>[r.partyCode,r])).values()].sort((a,b)=>partyLabel(a,sv).localeCompare(partyLabel(b,sv),sv?"sv":"en")),[localRows,sv]);
  const areas = catalog ? election==="KF" ? catalog.municipalities.filter(m=>!county||m.parent===county) : election==="RD" ? catalog.constituencies.filter(c=>!county||c.county===county) : catalog.counties.filter(c=>c.code!=="09"&&(!county||c.code===county)) : [];
  const fullRanking = useMemo(()=>rankCandidates(localRows.filter(r=>!party||r.partyCode===party),metric,minimum),[localRows,party,metric,minimum]);
  const ranking = useMemo(()=>fullRanking.filter(({row})=>!search||normalizeSearch(row.name).includes(normalizeSearch(search))),[fullRanking,search]);
  const f=(n:number,d=0)=>n.toLocaleString(sv?"sv-SE":"en-GB",{maximumFractionDigits:d,minimumFractionDigits:d});
  const metrics: {id:RankingMetric;name:string;detail:string}[]=[
    {id:"percent",name:sv?"Störst ökning, %":"Biggest rise, %",detail:sv?"Relativt föregående val":"Relative to previous election"},
    {id:"delta",name:sv?"Flest nya röster":"Most votes gained",detail:sv?"Ökning i antal":"Increase in vote count"},
    {id:"votes",name:sv?"Flest personröster":"Most personal votes",detail:sv?"Totalt i valt område":"Total in selected area"},
    {id:"sharePoints",name:sv?"Störst andelslyft":"Biggest share gain",detail:sv?"Andel av partiets röster, pp":"Share of party votes, pp"},
  ];
  const areaName=areas.find(a=>a.code===area)?.name, countyName=catalog?.counties.find(c=>c.code===county)?.name;
  usePublishSiteLocation("/rankings",query,[{label:electionLabel(election,sv),href:`/rankings/?election=${election}`},...(countyName?[{label:countyName,href:`/rankings/?election=${election}&county=${county}`}]:[]),...(areaName&&areaName!==countyName?[{label:areaName,href:`/rankings/${query}`}]:[])]);
  const columns: SortColumn<(typeof ranking)[number]>[] = [
    {key:"rank",label:"#",name:sv?"Placering":"Rank",direction:"ascending",value:r=>r.rank},
    {key:"name",label:sv?"Kandidat / område":"Candidate / area",name:sv?"Kandidat":"Candidate",direction:"ascending",value:({row})=>row.name},
    {key:"party",label:sv?"Parti":"Party",name:sv?"Parti":"Party",direction:"ascending",value:({row})=>partyLabel(row,sv)},
    {key:"previous",label:year-4,name:`${sv?"Personröster":"Personal votes"} ${year-4}`,value:({row})=>row.comparison.previous?.votes},
    {key:"votes",label:year,name:`${sv?"Personröster":"Personal votes"} ${year}`,value:({row})=>row.votes},
    {key:"change",label:sv?"Förändring":"Change",name:sv?"Förändring i procent":"Percentage change",value:({row})=>row.comparison.percent},
  ];
  if(metric==="sharePoints") columns.push({key:"sharePoints",label:sv?"Andelslyft":"Share gain",name:sv?"Andelslyft":"Share gain",value:({row})=>row.comparison.sharePoints});
  const table = useTableSort(ranking, columns, {key:"rank",direction:"ascending"}, tableContext);
  const currentPage=Math.min(page,Math.max(0,Math.ceil(ranking.length/50)-1));
  return <div className="candidate-page">
    <section className="candidate-hero"><span className="eyebrow">{sv?"PERSONRÖSTER · STATISTIKARKIV":"PERSONAL VOTES · STATS ARCHIVE"} / 2010–2022</span><h1>{sv?"Politikernas":"Politicians’"}<br/><em>{sv?"topplistor.":"leaderboards."}</em></h1><p>{sv?"Vem ökar mest? Vem får flest kryss? Följ personerna, partierna och utvecklingen från val till val.":"Who is gaining fastest? Who wins the most personal votes? Follow candidates, parties and performance from one election to the next."}</p></section>
    <div className="candidate-body">
      <div className="candidate-metric-tabs" role="group" aria-label={sv?"Välj topplista":"Choose leaderboard"}>{metrics.map(m=><button type="button" key={m.id} aria-pressed={metric===m.id} onClick={()=>update({metric:m.id})}><strong>{m.name}</strong><small>{m.detail}</small></button>)}</div>
      <div className="candidate-filters">
        <label>{sv?"Valår":"Election year"}<select value={year} onChange={e=>update({year:e.target.value})}>{[...CANDIDATE_YEARS].reverse().map(y=><option key={y}>{y}</option>)}</select></label>
        <label>{sv?"Val":"Election"}<select value={election} onChange={e=>update({election:e.target.value,area:"",party:""})}>{ELECTION_TYPES.map(t=><option key={t} value={t}>{electionLabel(t,sv)}</option>)}</select></label>
        <label>{sv?"Län":"County"}<select value={county} onChange={e=>update({county:e.target.value,area:"",party:""})}><option value="">{sv?"Hela Sverige":"All Sweden"}</option>{catalog?.counties.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
        <label>{election==="KF"?(sv?"Kommun":"Municipality"):election==="RD"?(sv?"Riksdagsvalkrets":"Riksdag constituency"):(sv?"Region":"Region")}<select value={area} onChange={e=>update({area:e.target.value,party:""})}><option value="">{sv?"Alla områden":"All areas"}</option>{areas.map(a=><option key={a.code} value={a.code}>{a.name}</option>)}</select></label>
        <label>{sv?"Parti i valt val":"Party in selected election"}<select value={party} onChange={e=>update({party:e.target.value})}><option value="">{sv?"Alla partier":"All parties"}</option>{parties.map(r=><option key={r.partyCode} value={r.partyCode}>{partyLabel(r,sv)}</option>)}</select></label>
        <label>{sv?"Minst röster i föregående val":"Minimum votes in previous election"}<select value={minimum} disabled={metric==="votes"} onChange={e=>update({minimum:e.target.value})}>{[0,1,10,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      </div>
      <div className="candidate-ranking-title"><div><span className="mini-label">{electionLabel(election,sv)} · {areaName??countyName??(sv?"Hela Sverige":"All Sweden")}</span><h2>{metrics.find(m=>m.id===metric)!.name}</h2><p>{metric==="votes"?year:`${year-4} → ${year}`} · {sv?"Officiella röster, beräknad placering":"Official votes, calculated ranking"}</p></div><label>{sv?"Sök i topplistan":"Search this leaderboard"}<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder={sv?"Kandidatens namn":"Candidate name"}/></label></div>
      {metric!=="votes"&&<p className="candidate-scope">{sv?"Endast positiva förändringar med en kopplad kandidatur i samma val och jämförbara område. Partibyten ingår. Båda röstetalen visas; 1 → 10 är +900 %, men bara 9 nya röster.":"Positive changes only, with a matched candidacy in the same election and comparable area. Party changes are included. Both vote counts are shown: 1 → 10 is +900%, but only 9 additional votes."}</p>}
      <p className="local-note">{election==="RD"?(sv?"En placering per kandidat och riksdagsvalkrets.":"One ranking entry per candidate and Riksdag constituency."):election==="KF"?(sv?"Kommunfullmäktigevalet, summerat över kommunens valkretsar.":"Municipal-council election, summed across the municipality’s constituencies."):(sv?"Regionvalet, summerat över regionens valkretsar.":"Regional election, summed across the region’s constituencies.")}</p>
      <p className="local-note">{sv?"Under röstetalen visas platsen på partiets valsedel i respektive vals slutresultat. Flera listplatser visas om valsedlarna skiljer sig åt. Öppna uppgiften för listnummer. Statistiken visar inte hur stor del av röstförändringen som beror på listplatsen.":"Below each vote count is the candidate’s position on the party’s ballot in that election’s final results. Multiple positions are shown when ballot lists differ. Open the entry for list numbers. These figures do not measure how much of the vote change was caused by list position."}</p>
      {!catalog?<CandidateLoading error={catalogState.error} retry={catalogState.retry}/>:!data?<CandidateLoading error={state.error} retry={state.retry}/>:<>
        <p className="candidate-result-count" role="status">{f(ranking.length)} {sv?"resultat i topplistan":"leaderboard entries"}{` · ${sv?"Placeringen gäller vald topplista, även vid sortering":"Ranks refer to the selected leaderboard, even when sorting"}`}</p>
        <MobileTableSort control={table} onSort={()=>setPage(0)}/><div className="local-table-scroll candidate-scoreboard candidate-scoreboard--ranking"><table><thead><tr><SortHeaders control={table} onSort={()=>setPage(0)}/></tr></thead><tbody>{table.rows.slice(currentPage*50,(currentPage+1)*50).map(({row:r,rank})=><tr key={`${r.person}:${r.areaCode}:${r.partyCode}`}><td className="candidate-rank">{rank}</td><th scope="row"><Link href={localizedHref(personHref(r.person,election,r.areaCode),locale)}>{r.name}<span aria-hidden="true"> ↗</span></Link><small>{r.areaName}</small></th><td>{r.comparison.previous&&r.comparison.previous.partyCode!==r.partyCode?<span className="candidate-party-change" title={`${year-4} → ${year}`}><CandidateParty result={r.comparison.previous} variant="text"/> <span>→</span> <CandidateParty result={r} variant="text"/></span>:<CandidateParty result={r}/>}</td><td data-label={String(year-4)}>{r.comparison.previous?<><span className="candidate-vote-count">{f(r.comparison.previous.votes)}</span><CandidateBallotPositions ballots={r.comparison.previous.ballotPositions} year={year-4}/></>:"—"}</td><td data-label={String(year)} className="candidate-total"><span className="candidate-vote-count">{f(r.votes)}</span><CandidateBallotPositions ballots={r.ballotPositions} year={year}/></td><td><VoteDelta comparison={r.comparison}/></td>{metric==="sharePoints"&&<td data-label={sv?"Andelslyft":"Share gain"}>{r.comparison.sharePoints===null?"—":`+${f(r.comparison.sharePoints,2)} pp`}</td>}</tr>)}</tbody></table></div>
        {!ranking.length&&<p className="candidate-empty">{sv?"Inga resultat uppfyller urvalet. Prova ett annat val, lägre minimiantal eller listan med flest personröster.":"No results meet these filters. Try another election, a lower minimum or the total personal-votes leaderboard."}</p>}
        {ranking.length>50&&<nav className="candidate-pagination" aria-label={sv?"Topplistans sidor":"Leaderboard pages"}><button className="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>{sv?"Föregående":"Previous"}</button><span>{currentPage+1} / {Math.ceil(ranking.length/50)}</span><button className="button" disabled={(currentPage+1)*50>=ranking.length} onClick={()=>setPage(currentPage+1)}>{sv?"Nästa":"Next"}</button></nav>}
      </>}
      {catalog&&<p className="local-note">{f(catalog.people)} {sv?"kandidatprofiler":"candidate profiles"} · {f(catalog.linkedPeople)} {sv?"historiker kopplade över flera val":"histories linked across elections"} · 2010–2022</p>}
      <CandidateMethod/>
    </div>
  </div>;
}
