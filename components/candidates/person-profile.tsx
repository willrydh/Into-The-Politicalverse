"use client";
import Link from "next/link";
import { MobileTableSort, SortHeaders, useTableSort } from "../table-sort";
import { ProfileDownload } from "./profile-download";
import { CandidateBallotPositions } from "./ballot-positions";
import { PocketPoliticsReferral } from "./pocketpolitics-referral";
import { ProfileStandings } from "./profile-standings";
import { ProfileSharing } from "./profile-sharing";
import { useLocale } from "../localize";
import { useLocalQuery, navigateLocalQuery } from "../maps/local-url";
import { usePublishSiteLocation } from "../site-location";
import { localizedHref } from "@/lib/i18n/translate";
import { CANDIDATE_YEARS, personShard, type Person } from "@/lib/candidates/types";
import { selectCandidateProfile } from "@/lib/candidates/profile-selection";
import { validatePersonShard } from "@/lib/candidates/validation";
import { compareCandidate, personalVoteShare } from "@/lib/candidates/math";
import { CandidateLoading, CandidateMethod, electionLabel, partyLabel, CandidateParty, reasonLabel, useCandidateResource, VoteDelta, VoteComparisonNote } from "./shared";

function Profile({person,sourceVersion}: {person:Person;sourceVersion:string}) {
  const locale=useLocale(),sv=locale==="sv",query=useLocalQuery(),params=new URLSearchParams(query);
  const {available,election,areas,area,results,latest}=selectCandidateProfile(person,params);
  const table = useTableSort(results.map(r=>({...r,comparison:compareCandidate(r,person.results)})), [
    {key:"year",label:sv?"Valår":"Year",name:sv?"Valår":"Year",value:r=>r.year},
    {key:"party",label:sv?"Parti":"Party",name:sv?"Parti":"Party",direction:"ascending",value:r=>partyLabel(r,sv)},
    {key:"votes",label:sv?"Personröster":"Personal votes",name:sv?"Personröster":"Personal votes",value:r=>r.votes},
    {key:"change",label:sv?"Förändring":"Change",name:sv?"Förändring i procent":"Percentage change",value:r=>r.comparison.percent},
    {key:"partyVotes",label:sv?"Partiets röster":"Party votes",name:sv?"Partiets röster":"Party votes",value:r=>r.partyVotes},
    {key:"share",label:sv?"Andel":"Share",name:sv?"Andel":"Share",value:personalVoteShare},
  ], {key:"year",direction:"descending"}, `${person.id}:${election}:${area}`);
  const constituencies = useTableSort(person.results.filter(r=>r.electionType===election&&r.level==="constituency"&&r.areaCode.startsWith(area)), [
    {key:"year",label:sv?"Val":"Election",name:sv?"Valår":"Year",value:r=>r.year},
    {key:"area",label:sv?"Valkrets":"Constituency",name:sv?"Valkrets":"Constituency",direction:"ascending",value:r=>r.areaName},
    {key:"party",label:sv?"Parti":"Party",name:sv?"Parti":"Party",direction:"ascending",value:r=>partyLabel(r,sv)},
    {key:"votes",label:sv?"Personröster":"Personal votes",name:sv?"Personröster":"Personal votes",value:r=>r.votes},
    {key:"partyVotes",label:sv?"Partiets röster":"Party votes",name:sv?"Partiets röster":"Party votes",value:r=>r.partyVotes},
  ], {key:"year",direction:"descending"}, `${person.id}:${election}:${area}`);
  const comparison=compareCandidate(latest,person.results);
  const fmt=(n:number,d=0)=>n.toLocaleString(sv?"sv-SE":"en-GB",{maximumFractionDigits:d,minimumFractionDigits:d});
  const name=areas.find(a=>a.code===area)?.name;
  const max=Math.max(1,...results.map(r=>r.votes));
  const years=[...new Set(person.results.map(r=>r.year))].sort();
  const byYear=years.map(year=>({year,parties:[...new Map(person.results.filter(r=>r.year===year).map(r=>[r.partyCode,r])).values()]}));
  function update(patch:Record<string,string>) { const next=new URLSearchParams(query);for(const[k,v]of Object.entries(patch)){if(v)next.set(k,v);else next.delete(k);}navigateLocalQuery(`?${next}`); }
  usePublishSiteLocation("/people",query,[{label:person.name,href:`/people/${query}`}]);
  return <>
    <ProfileSharing person={person} election={election} area={area} locale={locale} sourceVersion={sourceVersion}/>
    <section className="candidate-hero candidate-hero--person"><Link className="candidate-back" href={localizedHref(`/rankings/?election=${election}&area=${area}`,locale)}>← {sv?"Till topplistorna":"Leaderboards"}</Link><span className="eyebrow">{sv?"KANDIDATPROFIL · PERSONRÖSTER":"CANDIDATE PROFILE · PERSONAL VOTES"}</span><h1>{person.name}</h1><p>{sv?"Kandidaturer och valresultat, samlade över tid.":"Candidacies and election results, collected over time."}</p><div className="candidate-career" aria-label={sv?"Partier per valår":"Parties by election year"}>{byYear.map(({year,parties})=><div key={year}><small>{year}</small><strong><span className="party-group">{parties.map(r=><CandidateParty key={r.partyCode} result={r}/>)}</span></strong></div>)}</div></section>
    <div className="candidate-body">
      <p className="candidate-identity-note" data-classification="DERIVED">{person.linked?(sv?"Kopplad historik: namn, förenlig ålder och gemensam kommun i källorna. Partierna ovan visar kandidaturerna i varje val.":"Linked history: matching name, compatible age and a common municipality in the sources. Parties above show candidacies in each election."):(sv?"Den här profilen har ett valår. Det betyder inte att personen var ny i politiken; tidigare kandidaturer kan saknas eller ha ett annat namn eller kandidatnummer som ännu inte kunnat kopplas.":"This profile covers one election year. That does not mean the person was new to politics; earlier candidacies may be missing or have a different name or candidate number that could not be linked.")}</p>
      <div className="candidate-filters candidate-profile-filters"><label>{sv?"Val":"Election"}<select value={election} onChange={e=>update({election:e.target.value,area:""})}>{available.map(t=><option value={t} key={t}>{electionLabel(t,sv)}</option>)}</select></label><label>{election==="KF"?(sv?"Kommun":"Municipality"):election==="RF"?(sv?"Region":"Region"):(sv?"Riksdagsvalkrets":"Riksdag constituency")}<select value={area} onChange={e=>update({area:e.target.value})}>{areas.map(a=><option key={a.code} value={a.code}>{a.name}</option>)}</select></label></div>
      <div className="candidate-ranking-title"><div><span className="mini-label">{electionLabel(election,sv)} · {sv?"OFFICIELLA RÖSTER":"OFFICIAL VOTES"}</span><h2>{name}</h2><p>{sv?"Varje val redovisas separat. Röster från olika valtyper blandas aldrig.":"Each election is reported separately. Votes from different election types are never mixed."}</p></div></div>
      <div className="candidate-stat-grid"><div><span>{sv?"Personröster":"Personal votes"} · {latest.year}</span><strong>{fmt(latest.votes)}</strong><small><CandidateParty result={latest} withName/></small></div><div><span>{latest.year-4} → {latest.year}</span><VoteDelta comparison={comparison}/></div><div><span>{sv?"Andel av partiets röster":"Share of party votes"}</span><strong>{personalVoteShare(latest)===null?"—":`${fmt(personalVoteShare(latest)!,2)} %`}</strong><small>{comparison.sharePoints===null?"—":`${comparison.sharePoints>0?"↑ +":comparison.sharePoints<0?"↓ ":"→ "}${fmt(comparison.sharePoints,2)} ${sv?"procentenheter":"percentage points"}`}</small></div></div>
      {comparison.previous&&comparison.previous.partyCode!==latest.partyCode&&<p className="candidate-switch"><strong><CandidateParty result={comparison.previous} variant="text"/> <span>→</span> <CandidateParty result={latest} variant="text"/></strong> {sv?"Ändrad partikandidatur mellan de här valen.":"Changed party candidacy between these elections."}</p>}
      <ProfileStandings key={`${election}:${area}`} person={person.id} results={results} sourceVersion={sourceVersion} initialYear={Number(params.get("year")) || latest.year}/>
      <div className="candidate-history-chart" aria-label={sv?"Personröster per valår":"Personal votes by election year"}>{CANDIDATE_YEARS.map(year=>{const records=results.filter(r=>r.year===year);return <div className="candidate-history-year" key={year}>{records.length?records.map(r=><div key={r.partyCode} className="candidate-history-bar"><strong>{fmt(r.votes)}</strong><i style={{height:`${Math.max(2,r.votes/max*145)}px`}}/><small><CandidateParty result={r} variant="text"/></small></div>):<div className="candidate-history-gap">—<small>{sv?"Saknas":"Missing"}</small></div>}<b>{year}</b></div>;})}</div>
      <MobileTableSort control={table}/><div className="local-table-scroll candidate-scoreboard candidate-scoreboard--profile"><table><thead><tr><SortHeaders control={table}/></tr></thead><tbody>{table.rows.map(r=>{const change=r.comparison;return <tr key={`${r.year}:${r.partyCode}`}><th>{r.year}{r.supersededBy&&<small>{sv?"Omval":"Re-run"} {r.supersededBy}</small>}</th><td><CandidateParty result={r} withName/></td><td data-label={sv?"Personröster":"Personal votes"} className="candidate-total"><span className="candidate-vote-count">{fmt(r.votes)}</span><CandidateBallotPositions ballots={r.ballotPositions} year={r.year}/></td><td data-label={sv?"Förändring":"Change"}><VoteDelta comparison={change}/></td><td data-label={sv?"Partiets röster":"Party votes"}>{fmt(r.partyVotes)}</td><td data-label={sv?"Andel":"Share"}>{personalVoteShare(r)===null?"—":`${fmt(personalVoteShare(r)!,2)} %`}</td></tr>;})}</tbody></table></div>
      {table.rows.some(r=>r.comparison.delta===null)&&<VoteComparisonNote/>}
      <p className="local-note">{sv?"Tomma valår är saknat eller okopplat underlag, inte noll röster. Andelen är av partiets samtliga giltiga röster i området. När en kandidat byter parti ändras därför också jämförelsens partibas.":"Empty years mean missing or unmatched records, not zero votes. The share uses all valid party votes in the area. When a candidate changes parties, the party denominator changes too."}</p>
      {comparison.reason!=="comparable"&&comparison.reason!=="zero-baseline"&&<p className="local-notice">{reasonLabel(comparison.reason,sv)}</p>}
      <PocketPoliticsReferral/>
      {election!=="RD"&&<details className="candidate-method"><summary>{sv?"Visa valkretsarnas egna röstetal":"Show individual constituency results"}</summary><div className="local-table-scroll"><table className="local-table"><thead><tr><SortHeaders control={constituencies}/></tr></thead><tbody>{constituencies.rows.map(r=><tr key={`${r.year}:${r.areaCode}:${r.partyCode}`}><th>{r.year}</th><td>{r.areaName} · {r.areaCode}</td><td><CandidateParty result={r}/></td><td>{fmt(r.votes)}</td><td data-label={sv?"Partiets röster":"Party votes"}>{fmt(r.partyVotes)}</td></tr>)}</tbody></table></div></details>}
      <details className="candidate-method"><summary>{sv?"Kandidatnummer i källorna":"Candidate numbers in the sources"}</summary><p>{person.sourceIds.join(" · ")}</p>{person.aliases.length>1&&<p>{sv?"Namnformer":"Source name spellings"}: {person.aliases.join(" / ")}</p>}<ProfileDownload person={person}/></details>
      <CandidateMethod/>
    </div>
  </>;
}
export function CandidateProfile() {
  const locale=useLocale(),sv=locale==="sv",id=new URLSearchParams(useLocalQuery()).get("person")??"",valid=/^p\d{4}-\d+$/.test(id);
  const state=useCandidateResource(valid?`people/${personShard(id)}.json`:"",validatePersonShard);const person=state.data?.people[id];
  return <div className="candidate-page">{person?<Profile key={person.id} person={person} sourceVersion={state.data!.version}/>:<div className="candidate-body candidate-no-person"><h1>{sv?"Politikernas personhistorik":"Candidate histories"}</h1>{valid&&!state.data?<CandidateLoading error={state.error} retry={state.retry}/>:<><p>{valid?(sv?"Profilen kunde inte hittas.":"This profile could not be found."):(sv?"Hitta en kandidat via sökningen eller topplistorna för att följa personröster och partier över flera val.":"Find a candidate through search or the leaderboards to follow personal votes and parties across elections.")}</p><Link className="button" href={localizedHref("/search/",locale)}>{sv?"Sök kandidat":"Find a candidate"}</Link><Link className="button" href={localizedHref("/rankings/",locale)}>{sv?"Till topplistorna":"Open leaderboards"}</Link></>}</div>}</div>;
}
