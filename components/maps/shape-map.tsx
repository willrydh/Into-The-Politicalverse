"use client";
import { useId } from "react";
import type { LocalMap } from "@/lib/data/geography/local-types";
import { useLocale } from "../localize";

export function ShapeMap({map,areas,metric,color,selected,onSelect}: {map:LocalMap; areas:{code:string;name:string;value:number|null}[];metric:string;color:string;selected:string;onSelect:(code:string)=>void}) {
  const sv = useLocale() === "sv", id = useId(), pattern = `missing-${id.replace(/:/g,"")}`;
  const f = (v:number,d=1) => v.toLocaleString(sv?"sv-SE":"en-GB",{maximumFractionDigits:d});
  const byCode = new Map(areas.map(a => [a.code,a])), values = areas.map(a=>a.value).filter((n):n is number=>n!==null);
  const max = Math.max(.01,...values.map(v=>metric==="swing"?Math.abs(v):v)), min = metric==="swing" ? -max : 0;
  const fill=(v:number|null) => v===null?`url(#${pattern})`:metric==="swing"?`color-mix(in srgb, ${v<0?"#a34b43":"#1c5170"} ${15+Math.abs(v/max)*80}%, #f4f6f8)`:`color-mix(in srgb, ${metric==="turnout"?"#1c5170":color} ${12+v/max*85}%, #f4f6f8)`;
  const unit = metric==="swing"?" pp":" %";
  return <div className="local-map-box"><div className="local-map-legend"><span>{f(min)}{unit}</span><i style={{background:`linear-gradient(90deg, ${fill(min)}, ${fill(max)})`}}/><span>{f(max)}{unit}</span></div>
    <svg className="local-map" viewBox={map.viewBox} aria-label={sv?"Valkarta 2026":"Election map 2026"} role="group"><defs><pattern id={pattern} width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#eee"/><path d="M0 0L6 6" stroke="#bcc6cd" strokeWidth="1"/></pattern></defs>{map.areas.map(p=>{const a=byCode.get(p.code);const description=`${a?.name??p.code}: ${a?.value==null?(sv?"Uppgift saknas":"Unavailable"):`${f(a.value,2)}${unit}`}`;return <path key={p.code} d={p.path} fill={fill(a?.value??null)} className={`local-map-shape${p.code===selected?" is-selected":""}`} role="button" tabIndex={0} aria-label={description} aria-pressed={p.code===selected} onClick={()=>onSelect(p.code)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect(p.code);}}}><title>{description}</title></path>;})}</svg>
    <p className="local-map-help">{sv?"Klicka på ett område för att gå vidare.":"Select an area to explore it."}</p><p className="local-map-help"><span className="local-missing-key"/>{sv?"Uppgift eller jämförbart resultat saknas":"Data or a comparable result is unavailable"}</p>
  </div>;
}
