"use client";
import { useState } from "react";
import { SortHeaders, useTableSort } from "@/components/table-sort";
import Link from "next/link";
import { useLocale } from "@/components/localize";
import { localizedHref } from "@/lib/i18n/translate";
import type { LocalArea } from "@/lib/data/geography/local-types";
import type { LocalSelection } from "@/lib/data/geography/local-selection";
import { personHref } from "@/lib/candidates/types";
import { personalVoteShare } from "@/lib/candidates/math";
import { validatePersonalArea } from "@/lib/candidates/validation";
import { CandidateLoading, CandidateParty, partyLabel, useCandidateResource, VoteDelta, VoteComparisonNote } from "@/components/candidates/shared";

export function LocalPersonalVotes({ area, county, municipality, selection, constituencies, onConstituency }: { area: LocalArea; county?: LocalArea; municipality?: LocalArea; selection: LocalSelection; constituencies: Array<{ code: string; name: string }>; onConstituency: (code: string) => void }) {
  const locale=useLocale(),sv=locale==="sv";
  const options=constituencies.filter(c=>(county??area).constituencies?.includes(c.code));
  const home=constituencies.find(c=>municipality?.constituencies?.includes(c.code));
  const defaultCode=options.find(c=>area.constituencies?.includes(c.code))?.code??options[0]?.code??"";
  const code=options.some(c=>c.code===selection.constituency)?selection.constituency:defaultCode;
  const state=useCandidateResource(code?`areas/${selection.year}-${code}.json`:"",validatePersonalArea);
  const data=state.data?.year===selection.year&&state.data.code===code?state.data:undefined;
  const [searchInput,setSearch]=useState<string|null>(null),[all,setAll]=useState(false);
  const target=data?.rows.find(c=>`${c.partyCode}:${c.id}`===selection.candidate&&c.partyId===selection.party);
  const search=searchInput??target?.name??"";
  const candidates=data?.rows.filter(c=>c.partyId===selection.party&&(selection.candidate&&searchInput===null?c===target:`${c.name} ${c.partyName}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))).sort((a,b)=>b.votes-a.votes||a.name.localeCompare(b.name,"sv"))??[];
  const f=(n:number,d=0)=>n.toLocaleString(sv?"sv-SE":"en-GB",{minimumFractionDigits:d,maximumFractionDigits:d});
  const threshold=selection.year===2010?8:5;
  const table = useTableSort(candidates, [
    {key:"name",label:sv?"Kandidat":"Candidate",name:sv?"Kandidat":"Candidate",direction:"ascending",value:c=>c.name},
    {key:"votes",label:sv?"Personröster":"Personal votes",name:sv?"Personröster":"Personal votes",value:c=>c.votes},
    {key:"change",label:`${selection.year-4} → ${selection.year}`,name:sv?"Förändring i procent":"Percentage change",value:c=>c.comparison.percent},
    {key:"share",label:sv?"Andel av partiets röster":"Share of party votes",name:sv?"Andel av partiets röster":"Share of party votes",value:personalVoteShare},
    {key:"threshold",label:`${threshold} % ${sv?"spärr":"threshold"}`,name:sv?"Uppnådd personröstspärr":"Personal-vote threshold reached",value:c=>c.partyVotes>0?c.votes*100>=threshold*c.partyVotes:null},
  ], {key:"votes",direction:"descending"});
  function chooseConstituency(value:string){onConstituency(value);setSearch("");setAll(false);}
  return <section className="local-personal" id="personal-votes" aria-labelledby="personal-votes-title">
    <div className="local-section-title"><h2 id="personal-votes-title">{sv?"Personröster":"Personal votes"}</h2><span>{selection.year} · {sv?"Riksdagsvalkrets":"Riksdag constituency"}</span></div>
    <p className="local-note">{sv?"Personröstkällan redovisar hela riksdagsvalkretsen. Siffrorna nedan är inte kommunens eller valdistriktets egna personröster.":"The personal-vote source reports the whole Riksdag constituency. These figures are not personal votes for the municipality or electoral district alone."}</p>
    {county&&options.length>1&&<fieldset className="local-constituency-picker"><legend>{county.name} · {options.length} {sv?"riksdagsvalkretsar":"Riksdag constituencies"}</legend><div>{options.map(c=><button key={c.code} type="button" aria-pressed={c.code===code} onClick={()=>chooseConstituency(c.code)}>{c.name}</button>)}</div></fieldset>}
    {municipality&&home&&<p className="local-note local-personal-scope">{sv?<>{municipality.name} hör till <strong>{home.name}</strong> i kartans indelning från 2022.</>:<>{municipality.name} belongs to <strong>{home.name}</strong> in the map’s 2022 boundaries.</>} {options.length>1&&(sv?"Du kan välja en annan valkrets i länet. Valet gäller personrösterna; kartan behåller sitt område.":"You can select another constituency in the county. This changes the personal votes; the map keeps its selected area.")}</p>}
    <div className="local-list-controls"><label>{sv?"Riksdagsvalkrets för personröster":"Riksdag constituency for personal votes"}<select value={code} onChange={e=>chooseConstituency(e.target.value)} disabled={options.length===1}>{options.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label><label>{sv?"Sök kandidat":"Search candidates"}<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    <p className="local-note"><strong>{data?.name??options.find(c=>c.code===code)?.name} · <CandidateParty result={{partyId:selection.party,partyName:sv?"Övriga partier":"Other parties",year:selection.year}} withName/></strong></p>
    {!data?<CandidateLoading error={state.error} retry={state.retry}/>:<>
      <div className="local-table-scroll"><table className="local-table"><thead><tr><SortHeaders control={table}/></tr></thead><tbody>{(all||search?table.rows:table.rows.slice(0,10)).map(c=><tr key={`${c.partyCode}:${c.id}`}><th><Link className="candidate-profile-link" href={localizedHref(personHref(c.person,"RD",code),locale)}>{c.name} ↗</Link>{selection.party==="OTHER"&&<small className="local-candidate-party">{partyLabel(c,sv)}</small>}{c.comparison.previous&&c.comparison.previous.partyCode!==c.partyCode&&<small className="local-candidate-party"><CandidateParty result={c.comparison.previous} variant="text"/> <span>→</span> <CandidateParty result={c} variant="text"/></small>}</th><td>{f(c.votes)}</td><td><VoteDelta comparison={c.comparison}/></td><td>{personalVoteShare(c)===null?"—":`${f(personalVoteShare(c)!,2)} %`}</td><td>{c.partyVotes>0&&c.votes*100>=threshold*c.partyVotes?(sv?"Uppnådd":"Reached"):"—"}</td></tr>)}</tbody></table></div>
      {table.rows.some(c=>c.comparison.delta===null)&&<VoteComparisonNote/>}
      {!candidates.length&&<p>{sv?"Inga kandidater matchar urvalet.":"No candidates match the selection."}</p>}
      {candidates.length>10&&!search&&<button className="button local-show-all" type="button" onClick={()=>setAll(!all)}>{all?(sv?"Visa de första 10":"Show the first 10"):`${sv?"Visa alla":"Show all"} ${f(candidates.length)}`}</button>}
    </>}
    <p className="local-note">{sv?`Andelen använder partiets samtliga giltiga röster i valkretsen, inklusive godkända utlandsröster. Olika valsedelslistor är summerade. Att nå ${threshold} % är ingen garanti för ett mandat. Klicka på ett namn för personens historik över val och partier.`:`The denominator includes all valid party votes in the constituency, including accepted overseas votes. Ballot lists are combined. Reaching ${threshold}% does not guarantee a seat. Click a name for their history across elections and parties.`}</p>
    <div className="local-share"><Link className="button" href={localizedHref(`/rankings/?election=RD&year=${selection.year}&area=${code}&party=${selection.party==="OTHER"?"":({M:"0001",S:"0002",L:"0003",C:"0004",V:"0005",MP:"0053",KD:"0077",SD:"0110"} as Record<string,string>)[selection.party]??""}`,locale)}>{sv?"Topplista i valkretsen":"Constituency leaderboard"} →</Link>{municipality&&<Link className="button" href={localizedHref(`/rankings/?election=KF&year=${selection.year}&area=${municipality.code}`,locale)}>{sv?`Kommunvalets personröster i ${municipality.name}`:`Municipal personal votes in ${municipality.name}`} →</Link>}</div>
    <a className="local-source-link" href="https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022" target="_blank" rel="noreferrer">{sv?"Valmyndigheten: källor och arkiv":"Valmyndigheten: sources and archives"} ↗</a>
  </section>;
}
