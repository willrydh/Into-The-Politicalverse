"use client";
import "./candidates.css";
import { useEffect, useState } from "react";
import { useLocale } from "../localize";
import { PARTIES } from "@/lib/parties";
import { PartyMark } from "../party-mark";
import { translateText } from "@/lib/i18n/translate";
import type { CandidateComparison, CandidateElection, CandidateResult, ComparisonReason } from "@/lib/candidates/types";
export function useCandidateResource<T>(path: string, validate: (data: unknown) => asserts data is T) {
  const [state, setState] = useState<{path:string; data?:T; error?:boolean}>({path:""}), [attempt, retry] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController(); let active = true;
    const timeout = setTimeout(() => controller.abort(), 20000);
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/candidates/${path}`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error("Candidate response failed"); return r.json(); }).then(value => { validate(value); if (active) setState({path,data:value}); }).catch(() => {if(active) setState({path,error:true});}).finally(()=>clearTimeout(timeout));
    return () => {active=false; clearTimeout(timeout);controller.abort();};
  }, [path,validate,attempt]);
  return { ...(state.path === path ? state : {path}), retry:()=>retry(n=>n+1) };
}
export function CandidateLoading({error,retry}: {error?:boolean;retry:()=>void}) {
  const sv = useLocale() === "sv";
  return <div className="candidate-loading" role="status"><p>{error ? sv ? "Statistiken kunde inte hämtas." : "Statistics could not be loaded." : sv ? "Hämtar personröster och historik…" : "Loading personal votes and history…"}</p>{error && <button type="button" className="button" onClick={retry}>{sv?"Försök igen":"Try again"}</button>}</div>;
}
export const electionLabel = (type: CandidateElection, sv: boolean) => ({RD:sv?"Riksdag":"Riksdag",RF:sv?"Region":"Region",KF:sv?"Kommunfullmäktige":"Municipal council"})[type];
export const partyLabel = (r: Pick<CandidateResult,"partyName"|"partyId"> & {year?:number}, sv: boolean) => r.partyId === "L" && r.year && r.year <= 2014 ? (sv ? "Folkpartiet liberalerna" : "Liberal People’s Party") : r.partyId === "OTHER" ? r.partyName : translateText(PARTIES[r.partyId].name, sv ? "sv" : "en");
export function CandidateParty({ result, withName = false }: { result: Pick<CandidateResult,"partyName"|"partyId"> & {year?:number}; withName?: boolean }) {
  const label = partyLabel(result, useLocale() === "sv");
  return <span className="candidate-party"><PartyMark party={PARTIES[result.partyId]} label={label} size="sm" />{withName && result.partyId !== "OTHER" && <span>{label}</span>}</span>;
}
export const reasonLabel = (reason: ComparisonReason, sv: boolean) => ({
  "comparable":sv?"Jämförbart":"Comparable", "no-baseline":sv?"Tidigare jämförbart resultat saknas":"No matched previous result",
  "zero-baseline":sv?"Från 0 röster – procent saknas":"From 0 votes – percentage unavailable", "changed-area":sv?"Området är ändrat eller inte verifierat":"Area changed or not verified",
  "replaced-election":sv?"Ordinarie resultat följt av omval":"Original result followed by a re-run", "multiple-parties":sv?"Flera kandidaturer – ingen entydig jämförelse":"Multiple candidacies – no unique comparison"
})[reason];
export function VoteDelta({comparison,compact=false}: {comparison:CandidateComparison;compact?:boolean}) {
  const sv = useLocale() === "sv", fmt = (n:number,d=0)=>n.toLocaleString(sv?"sv-SE":"en-GB",{maximumFractionDigits:d,minimumFractionDigits:d});
  const delta=comparison.delta;
  return <span className={`vote-delta ${delta === null ? "is-missing" : delta > 0 ? "is-up" : delta < 0 ? "is-down" : "is-flat"}`} data-classification="DERIVED">
    {delta === null ? <span title={reasonLabel(comparison.reason,sv)}>—{!compact && <small>{reasonLabel(comparison.reason,sv)}</small>}</span> : <><strong>{delta>0?"↑":delta<0?"↓":"→"} {comparison.percent===null? (sv?"Från 0":"From 0") : `${delta>0?"+":""}${fmt(comparison.percent,1)} %`}</strong>{!compact && <small>{delta>0?"+":""}{fmt(delta)} {sv?"röster":"votes"}</small>}</>}
  </span>;
}
export function CandidateMethod() {
  const sv = useLocale() === "sv";
  return <details className="candidate-method"><summary>{sv?"Källor, kopplingar och beräkning":"Sources, identity links and calculation"}</summary>
    <p>{sv?"Officiella personröster från Valmyndighetens slutliga ordinarie val 2010, 2014, 2018 och 2022. Originalarkiven 2010–2018 är bevarade hos Internet Archive; 2022 kommer direkt från Valmyndighetens samlade Excel-filer. Kandidaternas valsedelslistor summeras inom rätt parti, val och område. Alla redovisade personröster ingår, även godkända utlandsröster i riksdagsvalet.":"Official personal votes from Valmyndigheten’s final regular elections in 2010, 2014, 2018 and 2022. The original 2010–2018 archives are preserved by the Internet Archive; 2022 comes directly from Valmyndigheten’s combined Excel files. Ballot lists are summed within the correct party, election and area. All reported personal votes are included, including accepted overseas votes in the Riksdag election."}</p>
    <p>{sv?"Kandidatnummer gäller inom ett val. Historik över flera val är en beräknad koppling med samma fullständiga namn, förenlig ålder och gemensam kommun i källorna. Tvetydiga träffar kopplas inte ihop. Namnbyten, flyttar och saknad ålder kan därför ge separata profiler. Kopplingen är inte ett officiellt personregister. Ett annat parti på en valsedel visar en ändrad kandidatur, inte ett verifierat datum för medlemsbyte.":"Candidate numbers identify candidates within one election. Cross-election histories are derived from matching full names, compatible ages and a common municipality in the sources. Ambiguous matches stay separate. Name changes, moves and missing ages can therefore result in separate profiles. This is not an official identity register. A different party on a ballot shows a changed candidacy, not a verified membership-change date."}</p>
    <p>{sv?"Förändring i procent = (nya röster − tidigare röster) / tidigare röster × 100. Andelen använder det aktuella partiets samtliga giltiga röster i området; skillnaden mellan andelar anges i procentenheter. Föregående val är alltid fyra år tidigare. Saknat resultat blir aldrig noll. Vid noll i jämförelsevalet visas ingen procent. Omval och förändrade eller overifierade valkretsgränser ger ingen topplistejämförelse.":"Percentage change = (new votes − previous votes) / previous votes × 100. The share uses all valid votes for that party in the area; changes in shares are percentage points. The comparison is always the election four years earlier. Missing results are never treated as zero. A zero baseline has no percentage. Re-run elections and changed or unverified constituency boundaries are excluded from change rankings."}</p>
    <p>{sv?"Kommunlistor räknar hela kommunfullmäktigevalet; regionlistor hela regionvalet. Riksdagslistor har en rad per kandidat och riksdagsvalkrets. En kandidat kan därför förekomma i flera valkretsar. Historiska filer kan sakna kandidaturer utan personröster; en saknad träff betyder inte att personen var ny i politiken.":"Municipal rankings cover the entire municipal-council election; regional rankings cover the whole region. Riksdag rankings contain one row per candidate and constituency, so a candidate can appear in several constituencies. Historical result files may omit candidacies without personal votes; a missing match does not mean the person was new to politics."}</p>
    <a href="https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022" target="_blank" rel="noreferrer">Valmyndigheten ↗</a><span> · </span><a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/candidates/index.json`}>{sv?"Källmanifest och täckning":"Source manifest and coverage"} ↗</a><p className="local-note">{sv?"OFFICIELLA röster · BERÄKNAD historik och förändring":"OFFICIAL votes · DERIVED history and changes"} · candidate-history-1.0.0</p>
  </details>;
}
