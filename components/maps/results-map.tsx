"use client";
import { useEffect, useState } from "react";
import { useLocale } from "../localize";
import { ShapeMap } from "./shape-map";
import { PARTY_IDS, type PartyId } from "@/lib/data/elections/types";
import { PARTIES } from "@/lib/parties";
import type { LocalArea, LocalIndexModel, LocalMap } from "@/lib/data/geography/local-types";
import { aggregateMunicipalVotes } from "@/lib/live/area-aggregate";
import { selectAreaResult, type AreaFeed, type AreaResult, type CountedArea, type ElectionType } from "@/lib/live/area-types";
import { areaVoteBuckets, districtAsArea, previousVoteBuckets } from "@/lib/live/map-districts";
import type { CountingStage } from "@/lib/live/types";
import { PartyMark } from "../party-mark";
import { translateText } from "@/lib/i18n/translate";
import { SortHeaders, useTableSort } from "../table-sort";

export function mapMetric(area: CountedArea | null, party: PartyId, metric: string): number | null {
  if (!area || !area.countedDistricts || !area.validVotes) return null;
  if (metric === "turnout") return area.turnoutInCountedDistricts;
  const share = areaVoteBuckets(area)[PARTY_IDS.indexOf(party)]/area.validVotes*100;
  if (metric !== "swing") return share;
  const old = previousVoteBuckets(area)?.[PARTY_IDS.indexOf(party)];
  return old == null || !area.previous?.validVotes ? null : share-old/area.previous.validVotes*100;
}

export function ResultsMap({geography,feed,result,area,type,stage,county,municipality,district,party,metric,change}: {geography:LocalIndexModel;feed:AreaFeed;result:AreaResult|null;area:CountedArea|null;type:ElectionType;stage?:CountingStage;county?:LocalArea;municipality?:LocalArea;district:string;party:PartyId;metric:string;change:(values:Record<string,string|null>)=>void}) {
  const locale = useLocale(), sv=locale==="sv", language=sv?"sv-SE":"en-GB", code=municipality?.code??county?.code??"SE";
  const [geometry,setGeometry]=useState<{code:string;map?:LocalMap;error?:boolean}>({code:""}),[attempt,setAttempt]=useState(0);
  const [search,setSearch]=useState("");
  useEffect(()=>{
    const controller=new AbortController();let active=true;const timeout=setTimeout(()=>controller.abort(),20_000);
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH??""}/api/elections/2026/maps/${code}.json`,{signal:controller.signal,cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("Map unavailable");return r.json();}).then(d=>{
      if(d.schemaVersion!==1||d.boundaryYear!==2026||d.code!==code||!/^([a-f0-9]{64})$/.test(d.archiveSha256)||!d.map?.areas?.length||typeof d.map.viewBox!=="string"||d.map.areas.some((a:{code:unknown;path:unknown})=>typeof a.code!=="string"||typeof a.path!=="string"))throw new Error("Invalid map");
      if(active)setGeometry({code,map:d.map});
    }).catch(()=>{if(active)setGeometry({code,error:true});}).finally(()=>clearTimeout(timeout));
    return()=>{active=false;controller.abort();clearTimeout(timeout);};
  },[code,attempt]);
  const f=(n:number|null|undefined,d=0)=>n==null?"—":n.toLocaleString(language,{maximumFractionDigits:d});
  const aggregate=(rows:CountedArea[],g:LocalArea,expected:number)=>rows.length===expected?aggregateMunicipalVotes(rows,g.code,g.name):null;
  const municipalities=geography.municipalities.filter(m=>!county||m.parent===county.code);
  const countyResult=(c:LocalArea):CountedArea|null=>{
    if(type==="RF")return selectAreaResult(feed,type,c.code,stage)?.area??null;
    const children=geography.municipalities.filter(m=>m.parent===c.code);
    const rows=type==="RD"?result?.municipalities.filter(m=>m.countyCode===c.code)??[]:children.flatMap(m=>{const a=selectAreaResult(feed,type,m.code,stage)?.area;return a?[a]:[];});
    return aggregate(rows,c,children.length);
  };
  const children:{code:string;name:string;area:CountedArea|null}[]=municipality?(result?.districts?.filter(d=>d.municipality===municipality.code).map(d=>({code:d.code,name:d.name,area:districtAsArea(d)}))??[]):county?municipalities.map(m=>({code:m.code,name:m.name,area:type==="KF"?selectAreaResult(feed,type,m.code,stage)?.area??null:result?.municipalities.find(a=>a.code===m.code)??null})):geography.counties.map(c=>({code:c.code,name:c.name,area:countyResult(c)}));
  const choose=(value:string)=>{setSearch("");if(municipality)change({district:value});else if(county)change({municipality:value,district:null});else change({county:value,municipality:null,district:null});};
  const selected=area??(county?countyResult(county):null), votes=selected?areaVoteBuckets(selected)[PARTY_IDS.indexOf(party)]:null;
  const share=mapMetric(selected,party,"share"),swing=mapMetric(selected,party,"swing"),old=selected?.previous;
  const oldVotes=selected?previousVoteBuckets(selected)?.[PARTY_IDS.indexOf(party)]:null;
  const chosenDistrict=result?.districts?.find(d=>d.code===district);
  const profileName=chosenDistrict?.name??municipality?.name??county?.name??(sv?"Sverige":"Sweden");
  const sourceArea=municipality??county??geography.national;
  const history:{year:number;share:number;votes:number}[]=!district&&type==="RD"?sourceArea.results.filter(r=>r.year<2022).map(r=>({year:r.year,share:r.votes[party]/r.validVotes*100,votes:r.votes[party]})):[];
  if(old&&oldVotes!=null)history.push({year:2022,share:oldVotes/old.validVotes*100,votes:oldVotes});
  if(share!==null&&votes!==null)history.push({year:2026,share,votes});
  const metricName=metric==="swing"?(sv?"Förändring, pp":"Change, pp"):metric==="turnout"?(sv?"Valdeltagande":"Turnout"):(sv?"Röstandel":"Vote share");
  const sorted=useTableSort(children.filter(a=>a.name.toLocaleLowerCase(language).includes(search.toLocaleLowerCase(language))),[
    {key:"name",label:sv?"Område":"Area",name:sv?"Område":"Area",direction:"ascending",value:a=>a.name},
    {key:"metric",label:metricName,name:metricName,value:a=>mapMetric(a.area,party,metric)},
    {key:"votes",label:sv?"Röster":"Votes",name:sv?"Röster":"Votes",value:a=>a.area?.countedDistricts?areaVoteBuckets(a.area)[PARTY_IDS.indexOf(party)]:null},
    {key:"turnout",label:sv?"Deltagande":"Turnout",name:sv?"Deltagande":"Turnout",value:a=>a.area?.turnoutInCountedDistricts??null},
  ],{key:"metric",direction:"descending"});
  const shownMap=geometry.code===code?geometry.map:undefined;
  return <>
    <nav className="local-breadcrumbs" aria-label={sv?"Område":"Area"}><button onClick={()=>change({county:null,municipality:null,district:null})}>{sv?"Sverige":"Sweden"}</button>{county&&<><span>/</span><button onClick={()=>change({municipality:null,district:null})}>{county.name}</button></>}{municipality&&<><span>/</span><button onClick={()=>change({district:null})}>{municipality.name}</button></>}{chosenDistrict&&<><span>/</span><strong>{chosenDistrict.name}</strong></>}</nav>
    <div className="local-workspace"><div className="local-map-column"><div className="local-section-title"><h2>{municipality?(sv?"Valdistrikt":"Electoral districts"):county?(sv?"Kommuner":"Municipalities"):(sv?"Län":"Counties")}</h2><span>2026</span></div>
      {shownMap?<ShapeMap map={shownMap} areas={children.map(a=>({code:a.code,name:a.name,value:mapMetric(a.area,party,metric)}))} metric={metric} color={PARTIES[party].color} selected={district} onSelect={choose}/>:<div className="local-map-placeholder" role="status">{geometry.code===code&&geometry.error?<><p>{sv?"Kartan kunde inte hämtas.":"The map could not be loaded."}</p><button className="button" onClick={()=>setAttempt(n=>n+1)}>{sv?"Försök igen":"Retry"}</button></>:<p>{sv?"Hämtar kartan…":"Loading map…"}</p>}</div>}
      <p className="local-note">{sv?"Valmyndighetens områdesgränser 2026. Uppsamlingsdistrikt ingår i totalsiffrorna och i listan, men har ingen egen yta på kartan.":"Official 2026 boundaries. Collection districts are included in totals and the list, but have no map polygon."}</p>
    </div><article className="local-profile"><span className="mini-label">2026 · {district?(sv?"Valdistrikt":"District"):municipality?(sv?"Kommun":"Municipality"):county?(sv?"Län":"County"):(sv?"Riket":"National")}</span><h2>{profileName}</h2><div className="map-party-heading"><PartyMark party={PARTIES[party]} size="md"/><strong>{translateText(PARTIES[party].name,locale)}</strong></div>
      <div className="local-profile-value">{f(share,2)}{share!==null&&" %"}</div><p>{f(selected?.countedDistricts?votes:null)} {sv?"röster":"votes"}</p>
      <dl className="area-facts"><div><dt>{sv?"Förändring från 2022":"Change since 2022"}</dt><dd>{swing!==null&&swing>0?"+":""}{f(swing,2)}{swing!==null&&" pp"}</dd></div><div><dt>{sv?"Valdeltagande":"Turnout"}</dt><dd>{f(selected?.turnoutInCountedDistricts,2)}{selected?.turnoutInCountedDistricts!=null&&" %"}</dd></div><div><dt>{sv?"Röstberättigade":"Eligible voters"}</dt><dd>{f(chosenDistrict?.collection?null:selected?.eligibleVoters)}</dd></div><div><dt>{sv?"Giltiga röster":"Valid votes"}</dt><dd>{f(selected?.countedDistricts?selected.validVotes:null)}</dd></div></dl>
      {history.length>1&&<div className="map-current-history"><h3>{sv?"Utveckling över tid":"Results over time"}</h3><svg viewBox="0 0 360 116" role="img" aria-label={history.map(r=>`${r.year}: ${f(r.share,2)} %`).join(", ")}><polyline points={history.map((r,i)=>`${12+i*336/(history.length-1)},${80-r.share/Math.max(1,...history.map(v=>v.share))*65}`).join(" ")} fill="none" stroke={PARTIES[party].color} strokeWidth="3"/>{history.map((r,i)=><text key={r.year} x={12+i*336/(history.length-1)} y="108" textAnchor={i===0?"start":i===history.length-1?"end":"middle"}>{r.year}</text>)}</svg><div className="map-year-values">{[...history].reverse().map(r=><span key={r.year}><small>{r.year}</small><strong>{f(r.share,2)} %</strong><small>{f(r.votes)} {sv?"röster":"votes"}</small></span>)}</div></div>}
      {swing===null&&<p className="local-note">{sv?"— Jämförbar uppgift saknas. Ändrade distriktsgränser kopplas inte ihop automatiskt.":"— No comparable figure is available. Changed district boundaries are not matched automatically."}</p>}
      {chosenDistrict?.collection&&<p className="local-note">{sv?"Uppsamlingsröster saknar egen röstlängd; valdeltagande kan inte beräknas här.":"Collection votes have no separate electoral roll; turnout is unavailable here."}</p>}
    </article></div>
    {children.length>0&&<section className="local-area-list"><div className="local-section-title"><h2>{sv?"Alla områden":"All areas"}</h2><span>{f(children.length)}</span></div><label className="area-search">{sv?"Sök område":"Find an area"}<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="local-table-scroll"><table className="local-table local-area-table"><thead><tr><SortHeaders control={sorted}/></tr></thead><tbody>{sorted.rows.map(a=><tr key={a.code} className={a.code===district?"is-selected":""}><th><button type="button" className="area-link" onClick={()=>choose(a.code)}>{a.name} →</button></th><td>{f(mapMetric(a.area,party,metric),2)}{mapMetric(a.area,party,metric)!==null&&(metric==="swing"?" pp":" %")}</td><td>{f(a.area?.countedDistricts?areaVoteBuckets(a.area)[PARTY_IDS.indexOf(party)]:null)}</td><td>{f(a.area?.turnoutInCountedDistricts,2)}{a.area?.turnoutInCountedDistricts!=null&&" %"}</td></tr>)}</tbody></table></div><p className="local-note">{sv?"Förändring visar procentenheter mot samma partis jämförbara röster 2022. Länssummor beräknas från kommunerna; olika val och räkningstillfällen läggs aldrig ihop.":"Change is in percentage points against comparable 2022 votes for the same party. County totals aggregate municipalities; elections and counting stages are never added together."}</p></section>}
  </>;
}
