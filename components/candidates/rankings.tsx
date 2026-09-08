"use client";
import { useMemo, useState } from "react";
import { MobileTableSort, SortHeaders, useTableSort, type SortColumn } from "../table-sort";
import Link from "next/link";
import { useLocale } from "../localize";
import { localizedHref } from "@/lib/i18n/translate";
import { useLocalQuery, navigateLocalQuery } from "../maps/local-url";
import { usePublishSiteLocation } from "../site-location";
import { CANDIDATE_YEARS, ELECTION_TYPES, personHref, type CandidateYear, type CandidateElection, type RankingMetric, type RankingRow } from "@/lib/candidates/types";
import { validateCatalog, validateRankings } from "@/lib/candidates/validation";
import { DOWN_BALLOT_MIN_POSITION, DOWN_BALLOT_MIN_VOTES, personalVoteShare } from "@/lib/candidates/math";
import { candidateLeaderboard, DEFAULT_RANKING_METRIC, RANKING_METRICS } from "@/lib/candidates/leaderboards";
import { RiksdagVoteResults } from "./riksdag-vote-results";
import { CandidateLoading, CandidateMethod, electionLabel, partyLabel, CandidateParty, useCandidateResource, VoteDelta, VoteComparisonNote } from "./shared";
import { normalizeSearch } from "@/lib/search/engine";
import { CandidateBallotPositions } from "./ballot-positions";
import { RankingMovement } from "./ranking-movement";

function RankingParty({ row, year }: { row: RankingRow; year: number }) {
  const previous = row.comparison.previous;
  return previous && previous.partyCode !== row.partyCode
    ? <span className="candidate-party-change" title={`${year-4} → ${year}`}><CandidateParty result={previous} variant="text"/> <span>→</span> <CandidateParty result={row} variant="text"/></span>
    : <CandidateParty result={row}/>;
}

export function CandidateRankings() {
  const locale = useLocale(), sv = locale === "sv", query = useLocalQuery(), p = new URLSearchParams(query);
  const year = CANDIDATE_YEARS.includes(Number(p.get("year")) as CandidateYear) ? Number(p.get("year")) as CandidateYear : CANDIDATE_YEARS.at(-1)!;
  const election = ELECTION_TYPES.includes(p.get("election") as CandidateElection) ? p.get("election") as CandidateElection : "KF";
  const metric = RANKING_METRICS.includes(p.get("metric") as RankingMetric) ? String(p.get("metric")) as RankingMetric : DEFAULT_RANKING_METRIC;
  const county=String(p.get("county")??""), area=String(p.get("area")??""), party=String(p.get("party")??""), minimum=[0,1,10,50,100].includes(Number(p.get("minimum"))) && p.has("minimum") ? Number(p.get("minimum")) : 1;
  const requestedCandidate = String(p.get("candidate") ?? "");
  const candidate = /^p\d{4}-\d+$/.test(requestedCandidate) ? requestedCandidate : "";
  const summedVotes = election === "RD" && metric === "votes" && !area;
  const [search,setSearch]=useState("");
  const [notesOpen,setNotesOpen]=useState(false);
  const tableContext = JSON.stringify([year,election,metric,county,area,party,minimum,search,candidate]);
  const [pagination,setPagination]=useState({context:tableContext,page:0});
  if(pagination.context!==tableContext) setPagination({context:tableContext,page:0});
  const page=pagination.context===tableContext?pagination.page:0;
  function setPage(nextPage:number) { setPagination({context:tableContext,page:nextPage}); }
  const catalogState = useCandidateResource("index.json",validateCatalog), state=useCandidateResource(`rankings/${year}-${election}.json`,validateRankings), catalog=catalogState.data;
  const data=state.data?.year===year && state.data.electionType===election ? state.data : undefined;
  function update(values: Record<string,string>) { const next=new URLSearchParams(query);next.delete("candidate");for(const [key,value]of Object.entries(values)){if(value)next.set(key,value);else next.delete(key);} navigateLocalQuery(`?${next}`);setPage(0); }
  const localRows = useMemo(()=>data?.rows.filter(r=>(!county||r.county===county)&&(!area||r.areaCode===area))??[],[data,county,area]);
  const parties=useMemo(()=>[...new Map(localRows.map(r=>[r.partyCode,r])).values()].sort((a,b)=>partyLabel(a,sv).localeCompare(partyLabel(b,sv),sv?"sv":"en")),[localRows,sv]);
  const areas = catalog ? election==="KF" ? catalog.municipalities.filter(m=>!county||m.parent===county) : election==="RD" ? catalog.constituencies.filter(c=>!county||c.county===county) : catalog.counties.filter(c=>c.code!=="09"&&(!county||c.code===county)) : [];
  const fullRanking = useMemo(()=>candidateLeaderboard(localRows.filter(r=>!party||r.partyCode===party),metric,minimum),[localRows,party,metric,minimum]);
  const ranking = useMemo(()=>fullRanking.filter(({row})=>(!candidate||row.person===candidate)&&(!search||normalizeSearch(row.name).includes(normalizeSearch(search)))),[fullRanking,search,candidate]);
  const f=(n:number,d=0)=>n.toLocaleString(sv?"sv-SE":"en-GB",{maximumFractionDigits:d,minimumFractionDigits:d});
  const metrics: {id:RankingMetric;name:string;shortName:string;detail:string}[]=[
    {id:"votes",name:sv?"Flest personröster":"Most personal votes",shortName:sv?"Personröster":"Personal votes",detail:sv?"Antal kryss i valt område":"Personal votes in selected area"},
    {id:"support",name:sv?"Stöd längre ned":"Support down the ballot",shortName:sv?"Stöd längre ned":"Down the ballot",detail:sv?`Personstöd från listplats ${DOWN_BALLOT_MIN_POSITION}`:`Personal support from position ${DOWN_BALLOT_MIN_POSITION}`},
    {id:"percent",name:sv?"Störst ökning, %":"Biggest rise, %",shortName:sv?"Ökning, %":"Rise, %",detail:sv?"Relativt föregående val":"Relative to previous election"},
    {id:"delta",name:sv?"Flest nya röster":"Most votes gained",shortName:sv?"Nya röster":"Votes gained",detail:sv?"Ökning i antal":"Increase in vote count"},
    {id:"sharePoints",name:sv?"Störst andelslyft":"Biggest share gain",shortName:sv?"Andelslyft":"Share gain",detail:sv?"Andel av partiets röster, pp":"Share of party votes, pp"},
  ];
  const areaName=areas.find(a=>a.code===area)?.name, countyName=catalog?.counties.find(c=>c.code===county)?.name;
  usePublishSiteLocation("/rankings",query,[{label:electionLabel(election,sv),href:`/rankings/?election=${election}`},...(countyName?[{label:countyName,href:`/rankings/?election=${election}&county=${county}`}]:[]),...(areaName&&areaName!==countyName?[{label:areaName,href:`/rankings/${query}`}]:[])]);
  const columns: SortColumn<(typeof ranking)[number]>[] = [
    {key:"rank",label:"#",name:sv?"Placering":"Rank",direction:"ascending",value:r=>r.rank},
    {key:"name",label:sv?"Kandidat / område":"Candidate / area",name:sv?"Kandidat":"Candidate",direction:"ascending",value:({row})=>row.name},
    {key:"party",label:sv?"Parti":"Party",name:sv?"Parti":"Party",direction:"ascending",value:({row})=>partyLabel(row,sv)},
    {key:"votes",label:year,name:`${sv?"Personröster":"Personal votes"} ${year}`,value:({row})=>row.votes},
    {key:"previous",label:year-4,name:`${sv?"Personröster":"Personal votes"} ${year-4}`,value:({row})=>row.comparison.previous?.votes},
    {key:"change",label:metric==="support"?(sv?"Personstöd":"Personal support"):(sv?"Förändring":"Change"),name:metric==="support"?(sv?"Andel personröster":"Personal-vote share"):(sv?"Förändring i procent":"Percentage change"),value:({row})=>metric==="support"?personalVoteShare(row):row.comparison.percent},
  ];
  if(metric==="sharePoints") columns.push({key:"sharePoints",label:sv?"Andelslyft":"Share gain",name:sv?"Andelslyft":"Share gain",value:({row})=>row.comparison.sharePoints});
  const table = useTableSort(ranking, columns, {key:"rank",direction:"ascending"}, tableContext);
  const currentPage=Math.min(page,Math.max(0,Math.ceil(ranking.length/50)-1));
  return <div className="candidate-page candidate-page--rankings">
    <section className="candidate-hero"><span className="eyebrow">{sv?"PERSONRÖSTER · STATISTIKARKIV":"PERSONAL VOTES · STATS ARCHIVE"} / {CANDIDATE_YEARS[0]}–{CANDIDATE_YEARS.at(-1)}</span><h1>{sv?"Politikernas":"Politicians’"}<br/><em>{sv?"topplistor.":"leaderboards."}</em></h1><p>{sv?"Vem ökar mest? Vem får flest kryss? Följ personerna, partierna och utvecklingen från val till val.":"Who is gaining fastest? Who wins the most personal votes? Follow candidates, parties and performance from one election to the next."}</p></section>
    <div className="candidate-body">
      <div className="candidate-metric-tabs" role="group" aria-label={sv?"Välj topplista":"Choose leaderboard"}>{metrics.map(m=><button type="button" key={m.id} aria-label={`${m.name}: ${m.detail}`} aria-pressed={metric===m.id} onClick={()=>update({metric:m.id})}><strong className="candidate-metric-full">{m.name}</strong><strong className="candidate-metric-short">{m.shortName}</strong><small>{m.detail}</small></button>)}</div>
      <div className="candidate-filters" id="ranking-filters">
        <label>{sv?"Valår":"Election year"}<select value={year} onChange={e=>update({year:e.target.value})}>{[...CANDIDATE_YEARS].reverse().map(y=><option key={y}>{y}</option>)}</select></label>
        <label>{sv?"Val":"Election"}<select value={election} onChange={e=>update({election:e.target.value,area:"",party:""})}>{ELECTION_TYPES.map(t=><option key={t} value={t}>{electionLabel(t,sv)}</option>)}</select></label>
        <label>{sv?"Län":"County"}<select value={county} onChange={e=>update({county:e.target.value,area:"",party:""})}><option value="">{sv?"Hela Sverige":"All Sweden"}</option>{catalog?.counties.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
        <label>{election==="KF"?(sv?"Kommun":"Municipality"):election==="RD"?(sv?"Riksdagsvalkrets":"Riksdag constituency"):(sv?"Region":"Region")}<select value={area} onChange={e=>update({area:e.target.value,party:""})}><option value="">{sv?"Alla områden":"All areas"}</option>{areas.map(a=><option key={a.code} value={a.code}>{a.name}</option>)}</select></label>
        <label>{sv?"Parti i valt val":"Party in selected election"}<select value={party} onChange={e=>update({party:e.target.value})}><option value="">{sv?"Alla partier":"All parties"}</option>{parties.map(r=><option key={r.partyCode} value={r.partyCode}>{partyLabel(r,sv)}</option>)}</select></label>
        <label>{sv?"Minst röster i föregående val":"Minimum votes in previous election"}<select value={minimum} disabled={metric==="votes"||metric==="support"} onChange={e=>update({minimum:e.target.value})}>{[0,1,10,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      </div>
      <div className="candidate-ranking-title"><div><span className="mini-label">{electionLabel(election,sv)} · {areaName??countyName??(sv?"Hela Sverige":"All Sweden")}</span><h2>{metrics.find(m=>m.id===metric)!.name}</h2><p>{metric==="votes"||metric==="support"?year:`${year-4} → ${year}`} · {sv?"Officiella röster, beräknad placering":"Official votes, calculated ranking"}</p></div><label>{sv?"Sök i topplistan":"Search this leaderboard"}<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder={sv?"Kandidatens namn":"Candidate name"}/></label></div>
      {metric==="support"&&<p className="candidate-leaderboard-intro">{sv?`Minst ${DOWN_BALLOT_MIN_VOTES} personröster. Plats ${DOWN_BALLOT_MIN_POSITION} eller längre ned på alla redovisade valsedlar i området. Rangordnat efter andel av partiets röster — inte ett betyg på politiskt arbete eller ett mått där listplatsens effekt räknats bort.`:`At least ${DOWN_BALLOT_MIN_VOTES} personal votes. Position ${DOWN_BALLOT_MIN_POSITION} or lower on every reported ballot in the area. Ranked by share of party votes — not a rating of political work or a measure adjusted for the effect of ballot position.`}</p>}
      {election==="RD"&&<p className="candidate-leaderboard-intro">{summedVotes?(sv?"En rad per kandidat och parti. Personröster från valkretsarna i urvalet summeras. Öppna raden för att se varje valkrets.":"One row per candidate and party. Personal votes are summed across constituencies in the selection. Expand a row to see each constituency."):(sv?"Här jämförs valkretsresultat. Samma person kan ha olika resultat i flera valkretsar; andelar och förändringar summeras inte.":"This view compares constituency results. A person can have different results in several constituencies; shares and changes are not added together.")}</p>}
      {candidate&&<p className="candidate-focused-result">{sv?`Visar kandidatens placering bland ${f(fullRanking.length)} resultat i hela urvalet.`:`Showing the candidate’s rank among ${f(fullRanking.length)} entries in the full selection.`} <button type="button" onClick={()=>update({candidate:""})}>{sv?"Visa hela topplistan":"Show full leaderboard"}</button></p>}
      <div className="candidate-ranking-notes" data-expanded={notesOpen}>
      <button className="candidate-notes-toggle" type="button" aria-expanded={notesOpen} aria-controls="ranking-notes" onClick={()=>setNotesOpen(!notesOpen)}>{sv?"Så läser du siffrorna":"How to read the figures"}<span aria-hidden="true">{notesOpen?"−":"+"}</span></button>
      <div id="ranking-notes">
      {metric!=="votes"&&metric!=="support"&&<p className="candidate-scope">{sv?"Endast positiva förändringar med en kopplad kandidatur i samma val och jämförbara område. Partibyten ingår. Båda röstetalen visas; 1 → 10 är +900 %, men bara 9 nya röster.":"Positive changes only, with a matched candidacy in the same election and comparable area. Party changes are included. Both vote counts are shown: 1 → 10 is +900%, but only 9 additional votes."}</p>}
      <p className="local-note">{election==="RD"?(sv?"Antalslistan summerar valkretsar inom urvalet. Jämförelselistorna behåller varje valkrets separat.":"Total-vote rankings sum constituencies within the selection. Comparison rankings keep each constituency separate."):election==="KF"?(sv?"Kommunfullmäktigevalet, summerat över kommunens valkretsar.":"Municipal-council election, summed across the municipality’s constituencies."):(sv?"Regionvalet, summerat över regionens valkretsar.":"Regional election, summed across the region’s constituencies.")}</p>
      <p className="candidate-mobile-note local-note">{sv?"Placeringen gäller vald topplista, även vid sortering. Andelslyft mäts i procentenheter av partiets röster och kan vara positivt även om antalet personröster minskar.":"Ranks refer to the selected leaderboard, even when sorting. Share gain is measured in percentage points of party votes and can be positive even when personal votes fall."}</p>
      </div></div>
      {!catalog?<CandidateLoading error={catalogState.error} retry={catalogState.retry}/>:!data?<CandidateLoading error={state.error} retry={state.retry}/>:<>
        <p className="candidate-result-count" role="status">{f(ranking.length)} {sv?"resultat i topplistan":"leaderboard entries"}<span className="candidate-rank-explanation">{` · ${sv?"Placeringen gäller vald topplista, även vid sortering":"Ranks refer to the selected leaderboard, even when sorting"}`}</span></p>
        {summedVotes ? <RiksdagVoteResults entries={ranking} year={year} context={tableContext}/> : <>
        <MobileTableSort control={table} onSort={()=>setPage(0)}/>
        <div className="local-table-scroll candidate-scoreboard candidate-scoreboard--ranking">
          <table><thead><tr><SortHeaders control={table} onSort={()=>setPage(0)}/></tr></thead>
            <tbody>{table.rows.slice(currentPage*50,(currentPage+1)*50).map(({row:r,rank})=><tr key={`${r.person}:${r.areaCode}:${r.partyCode}`}>
              <td className="candidate-rank">{rank}</td>
              <th scope="row">
                <div className="candidate-ranking-heading">
                  <Link href={localizedHref(`${personHref(r.person,election,r.areaCode)}&year=${year}`,locale)}>{r.name}<span aria-hidden="true"> ↗</span></Link>
                  <RankingMovement row={r} metric={metric}/>
                </div>
                <small className="candidate-ranking-meta"><span>{r.areaName}</span><span className="candidate-ranking-party"><span aria-hidden="true">·</span><RankingParty row={r} year={year}/></span></small>
              </th>
              <td><RankingParty row={r} year={year}/></td>
              <td data-label={String(year)} className="candidate-total"><span className="candidate-vote-count">{f(r.votes)}</span><CandidateBallotPositions ballots={r.ballotPositions} year={year}/></td>
              <td data-label={String(year-4)}>{r.comparison.previous?<><span className="candidate-vote-count">{f(r.comparison.previous.votes)}</span><CandidateBallotPositions ballots={r.comparison.previous.ballotPositions} year={year-4}/></>:"—"}</td>
              <td>{metric==="support"?<span className="vote-delta"><strong>{f(personalVoteShare(r)!,2)} %</strong><small>{sv?"av partiets röster":"of party votes"}</small></span>:<VoteDelta comparison={r.comparison}/>}</td>
              {metric==="sharePoints"&&<td data-label={sv?"Andelslyft":"Share gain"}>{r.comparison.sharePoints===null?"—":`+${f(r.comparison.sharePoints,2)} pp`}</td>}
            </tr>)}</tbody>
          </table>
        </div>
        {!ranking.length&&<p className="candidate-empty">{sv?"Inga resultat uppfyller urvalet. Prova ett annat val, lägre minimiantal eller listan med flest personröster.":"No results meet these filters. Try another election, a lower minimum or the total personal-votes leaderboard."}</p>}
        {ranking.length>50&&<nav className="candidate-pagination" aria-label={sv?"Topplistans sidor":"Leaderboard pages"}><button className="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>{sv?"Föregående":"Previous"}</button><span>{currentPage+1} / {Math.ceil(ranking.length/50)}</span><button className="button" disabled={(currentPage+1)*50>=ranking.length} onClick={()=>setPage(currentPage+1)}>{sv?"Nästa":"Next"}</button></nav>}
        {metric!=="support"&&table.rows.some(({row})=>row.comparison.delta===null)&&<VoteComparisonNote/>}
        </>}
      </>}
      <p className="local-note">{sv?"Listplats avser placeringen på partiets valsedel. Flera platser kan förekomma; öppna uppgiften för alla listnummer.":"List position is the candidate’s place on the party’s ballot. Positions can differ between lists; open the entry for all list numbers."}</p>
      {catalog&&<p className="local-note">{f(catalog.people)} {sv?"kandidatprofiler":"candidate profiles"} · {f(catalog.linkedPeople)} {sv?"historiker kopplade över flera val":"histories linked across elections"} · {CANDIDATE_YEARS[0]}–{CANDIDATE_YEARS.at(-1)}</p>}
      <CandidateMethod/>
    </div>
  </div>;
}
