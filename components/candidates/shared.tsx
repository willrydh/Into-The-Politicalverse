"use client";
import "./candidates.css";
import { useEffect, useState } from "react";
import { useLocale } from "../localize";
import { PARTIES } from "@/lib/parties";
import { PartyMark } from "../party-mark";
import { PartyAbbreviation } from "../party-label";
import { translateText } from "@/lib/i18n/translate";
import { CANDIDATE_METHOD } from "@/lib/candidates/types";
import { DOWN_BALLOT_MIN_POSITION, DOWN_BALLOT_MIN_VOTES } from "@/lib/candidates/math";
import { compactCandidateNumber } from "@/lib/candidates/format";
import type { CandidateComparison, CandidateElection, CandidateResult, ComparisonReason } from "@/lib/candidates/types";
export function useCandidateResource<T>(path: string, validate: (data: unknown) => asserts data is T) {
  const [state, setState] = useState<{path:string; data?:T; error?:boolean}>({path:""}), [attempt, retry] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController(); let active = true;
    const timeout = setTimeout(() => controller.abort(), 20000);
    // A new client must not validate an older cached payload against its schema.
    // Revalidation retains HTTP caching while checking for a newer static file.
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/candidates/${path}?method=${CANDIDATE_METHOD}`, { signal: controller.signal, cache: "no-cache" }).then(r => { if (!r.ok) throw new Error("Candidate response failed"); return r.json(); }).then(value => { validate(value); if (active) setState({path,data:value}); }).catch(() => {if(active) setState({path,error:true});}).finally(()=>clearTimeout(timeout));
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
export function CandidateParty({ result, withName = false, variant = "logo" }: { result: Pick<CandidateResult,"partyName"|"partyId"> & {year?:number}; withName?: boolean; variant?: "logo" | "text" }) {
  const label = partyLabel(result, useLocale() === "sv");
  if (variant === "text") return <span className="candidate-party">{result.partyId === "OTHER" || withName ? label : <PartyAbbreviation partyId={result.partyId} year={result.year}/>}</span>;
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
    {delta === null ? <span role="img" aria-label={reasonLabel(comparison.reason,sv)} title={reasonLabel(comparison.reason,sv)}>—</span> : <><strong title={comparison.percent===null?undefined:`${comparison.percent>0?"+":""}${fmt(comparison.percent,1)} %`} aria-label={comparison.percent===null?undefined:`${comparison.percent>0?"+":""}${fmt(comparison.percent,1)} %`}>{delta>0?"↑":delta<0?"↓":"→"} {comparison.percent===null? (sv?"Från 0":"From 0") : `${delta>0?"+":""}${compactCandidateNumber(comparison.percent,sv)} %`}</strong>{!compact && <small>{delta>0?"+":""}{fmt(delta)} {sv?"röster":"votes"}</small>}</>}
  </span>;
}
export function VoteComparisonNote() {
  const sv = useLocale() === "sv";
  return <p className="local-note vote-comparison-note">{sv
    ? "— i förändringskolumnen betyder att jämförbart underlag saknas, inte noll förändring."
    : "— in the change column means comparable data is unavailable, not zero change."}</p>;
}
export function CandidateMethod() {
  const sv = useLocale() === "sv";
  return <details className="candidate-method"><summary>{sv?"Källor, kopplingar och beräkning":"Sources, identity links and calculation"}</summary>
    <p>{sv?"Officiella personröster från Valmyndighetens slutliga ordinarie val 2010, 2014, 2018 och 2022. Originalarkiven 2010–2018 är bevarade hos Internet Archive; 2022 kommer direkt från Valmyndighetens samlade Excel-filer. Kandidaternas valsedelslistor summeras inom rätt parti, val och område. Alla redovisade personröster ingår, även godkända utlandsröster i riksdagsvalet.":"Official personal votes from Valmyndigheten’s final regular elections in 2010, 2014, 2018 and 2022. The original 2010–2018 archives are preserved by the Internet Archive; 2022 comes directly from Valmyndigheten’s combined Excel files. Ballot lists are summed within the correct party, election and area. All reported personal votes are included, including accepted overseas votes in the Riksdag election."}</p>
    <p>{sv?"Kandidatnummer gäller inom ett val. Historik över flera val är en beräknad koppling med samma fullständiga namn, förenlig ålder och gemensam kommun i källorna. Tvetydiga träffar kopplas inte ihop. Namnbyten, flyttar och saknad ålder kan därför ge separata profiler. Kopplingen är inte ett officiellt personregister. Ett annat parti på en valsedel visar en ändrad kandidatur, inte ett verifierat datum för medlemsbyte.":"Candidate numbers identify candidates within one election. Cross-election histories are derived from matching full names, compatible ages and a common municipality in the sources. Ambiguous matches stay separate. Name changes, moves and missing ages can therefore result in separate profiles. This is not an official identity register. A different party on a ballot shows a changed candidacy, not a verified membership-change date."}</p>
    <p>{sv?"Listplats är kandidatens tryckta plats på partiets valsedel, inte placeringen efter personröster eller mandatfördelning. Alla skilda listor och platser som slutresultatets personröstdata redovisar för kandidaten i området visas. Andra registrerade valsedlar kan saknas. Saknad uppgift ersätts inte med en gissad plats. En ändrad listplats och fler personröster visar ett samband i historiken, inte hur mycket listplatsen orsakade ökningen.":"List position is the candidate’s printed position on the party’s ballot, not their rank by personal votes or seat allocation. All distinct ballot lists and positions reported for the candidate in the area’s final personal-vote data are shown. Other registered ballot lists may be absent. Missing information is never replaced by a guessed position. A changed list position alongside more personal votes is an observation, not a measure of the position’s causal effect."}</p>
    <p>{sv?"Förändring i procent = (nya röster − tidigare röster) / tidigare röster × 100. Andelen använder det aktuella partiets samtliga giltiga röster i området; skillnaden mellan andelar anges i procentenheter. Föregående val är alltid fyra år tidigare. Saknat resultat blir aldrig noll. Vid noll i jämförelsevalet visas ingen procent. Omval och förändrade eller overifierade valkretsgränser ger ingen topplistejämförelse.":"Percentage change = (new votes − previous votes) / previous votes × 100. The share uses all valid votes for that party in the area; changes in shares are percentage points. The comparison is always the election four years earlier. Missing results are never treated as zero. A zero baseline has no percentage. Re-run elections and changed or unverified constituency boundaries are excluded from change rankings."}</p>
    <p>{sv?"Kommunlistor räknar hela kommunfullmäktigevalet; regionlistor hela regionvalet. Riksdagens antalslista summerar kandidatens personröster per parti över valkretsarna i urvalet; varje valkrets kan öppnas. Andelar och förändringar jämförs per valkrets och summeras aldrig. Historiska filer kan sakna kandidaturer utan personröster; en saknad träff betyder inte att personen var ny i politiken.":"Municipal rankings cover the entire municipal-council election; regional rankings cover the whole region. Riksdag total-vote rankings sum each candidate’s personal votes per party across the selected constituencies; individual constituencies can be expanded. Shares and changes are compared per constituency and are never added together. Historical result files may omit candidacies without personal votes; a missing match does not mean the person was new to politics."}</p>
    <p>{sv?`Stöd längre ned kräver minst ${DOWN_BALLOT_MIN_VOTES} personröster och plats ${DOWN_BALLOT_MIN_POSITION} eller längre ned på samtliga valsedlar som personröstkällan redovisar i området. Rangordningen använder personröster delat med partiets samtliga giltiga röster i området. Urvalet är en redaktionell avgränsning, inte en statistisk justering för listplats, kampanj, kändisskap eller partistorlek. Saknade listplatser kvalificerar inte. Registrerade valsedlar utanför personröstkällan kan saknas.`:`Support down the ballot requires at least ${DOWN_BALLOT_MIN_VOTES} personal votes and position ${DOWN_BALLOT_MIN_POSITION} or lower on every ballot reported by the personal-vote source in the area. It ranks personal votes divided by all valid party votes in that area. The selection is an editorial cutoff, not a statistical adjustment for ballot position, campaigning, fame or party size. Missing positions do not qualify. Registered ballots outside the personal-vote source may be absent.`}</p>
    <p>{sv?"Profilens placeringar beräknas för valt valår, valtyp, område och partiurval, med minst 1 röst i jämförelsevalet där en förändring krävs. Topp 100 betyder plats 51–100, Topp 50 betyder plats 50 och plats 1–49 visas exakt. Delade värden får samma placering. I stora procenttal betyder t tusen och M miljoner; beräkning och sortering använder den fullständiga siffran.":"Profile rankings use the selected election year, election type, area and party filter, with at least 1 prior vote where a change is required. Top 100 means ranks 51–100, Top 50 means rank 50, and ranks 1–49 are shown exactly. Equal values share a rank. In large percentages, k means thousand and M means million; calculations and sorting use the full value."}</p>
    <a href="https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022" target="_blank" rel="noreferrer">Valmyndigheten ↗</a><span> · </span><a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/candidates/index.json`}>{sv?"Källmanifest och täckning":"Source manifest and coverage"} ↗</a><p className="local-note">{sv?"OFFICIELLA röster · BERÄKNAD historik och förändring":"OFFICIAL votes · DERIVED history and changes"} · {CANDIDATE_METHOD}</p>
  </details>;
}
