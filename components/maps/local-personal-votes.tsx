"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/localize";
import type { LocalArea } from "@/lib/data/geography/local-types";
import type { LocalSelection } from "@/lib/data/geography/local-selection";
import { clearsPersonalThreshold, personalShare, type PersonalConstituency } from "@/lib/data/geography/personal-votes";
import { PARTIES } from "@/lib/parties";

export function LocalPersonalVotes({ area, county, municipality, selection, constituencies, onConstituency }: { area: LocalArea; county?: LocalArea; municipality?: LocalArea; selection: LocalSelection; constituencies: Array<{ code: string; name: string }>; onConstituency: (code: string) => void }) {
  const locale = useLocale(); const sv = locale === "sv";
  const options = constituencies.filter(c => (county ?? area).constituencies?.includes(c.code));
  const home = constituencies.find(c => municipality?.constituencies?.includes(c.code));
  const defaultCode = options.find(c => area.constituencies?.includes(c.code))?.code ?? options[0]?.code ?? "";
  const code = options.some(c => c.code === selection.constituency) ? selection.constituency : defaultCode;
  const [state, setState] = useState<{ code: string; data?: PersonalConstituency; error?: boolean }>({ code: "" });
  const [attempt, setAttempt] = useState(0); const [search, setSearch] = useState(""); const [all, setAll] = useState(false);
  useEffect(() => {
    if (!code || selection.year !== 2022) return;
    const controller = new AbortController(); let active = true; const timeout = setTimeout(() => controller.abort(), 20_000);
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/elections/local/personal/${code}.json`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Personal source response failed"); return r.json(); })
      .then(value => {
        if (value.schemaVersion !== 1 || value.electionType !== "RD" || value.year !== 2022 || value.level !== "constituency" || value.status !== "final" || value.source?.publisher !== "Valmyndigheten" || value.constituency?.code !== code || !Array.isArray(value.constituency?.candidates)) throw new Error("Invalid personal-vote response");
        if (active) setState({ code, data: value.constituency });
      }).catch(() => { if (active) setState({ code, error: true }); }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [code, selection.year, attempt]);
  const data = state.code === code ? state.data : undefined;
  const candidates = data?.candidates.filter(c => c.partyId === selection.party && `${c.name} ${c.partyName}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) ?? [];
  const f = (n: number, d = 0) => new Intl.NumberFormat(sv ? "sv-SE" : "en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  function chooseConstituency(value: string) { onConstituency(value); setSearch(""); setAll(false); }
  return <section className="local-personal" id="personal-votes" aria-labelledby="personal-votes-title"><div className="local-section-title"><h2 id="personal-votes-title">{sv ? "Personröster" : "Personal votes"}</h2><span>2022 · {sv ? "Riksdagsvalkrets" : "Riksdag constituency"}</span></div>
    <p className="local-note">{sv ? "Personröstkällan redovisar hela riksdagsvalkretsen. Siffrorna nedan är inte kommunens eller valdistriktets egna personröster." : "The personal-vote source reports the whole Riksdag constituency. These figures are not personal votes for the municipality or electoral district alone."}</p>
    {selection.year !== 2022 ? <p className="local-notice">{sv ? "Personröster är inlästa för 2022. Välj 2022 ovan för att visa dem." : "Personal votes are available for 2022. Select 2022 above to view them."}</p> : <>
      {county && options.length > 1 && <fieldset className="local-constituency-picker">
        <legend>{county.name} · {options.length} {sv ? "riksdagsvalkretsar" : "Riksdag constituencies"}</legend>
        <div>{options.map(c => <button key={c.code} type="button" aria-pressed={c.code === code} onClick={() => chooseConstituency(c.code)}>{c.name}</button>)}</div>
      </fieldset>}
      {municipality && home && <p className="local-note local-personal-scope">{sv ? <>{municipality.name} hör till <strong>{home.name}</strong>.</> : <>{municipality.name} belongs to <strong>{home.name}</strong>.</>} {options.length > 1 && (sv ? "Du kan välja en annan valkrets i länet här. Valet gäller personrösterna; kartan och de lokala valresultaten behåller sitt område." : "You can select another constituency in the county here. This changes the personal votes; the map and local election results keep their selected area.")}</p>}
      <div className="local-list-controls"><label>{sv ? "Riksdagsvalkrets för personröster" : "Riksdag constituency for personal votes"}<select value={code} onChange={e => chooseConstituency(e.target.value)} disabled={options.length === 1}>{options.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label><label>{sv ? "Sök kandidat" : "Search candidates"}<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
      <p className="local-note"><strong>{data?.name ?? options.find(c => c.code === code)?.name} · {selection.party === "OTHER" ? (sv ? "Övriga partier" : "Other parties") : PARTIES[selection.party].name}</strong></p>
      {!data ? <div role="status"><p>{state.code === code && state.error ? (sv ? "Personrösterna kunde inte hämtas." : "Personal votes could not be loaded.") : (sv ? "Hämtar personröster…" : "Loading personal votes…")}</p>{state.code === code && state.error && <button className="button" type="button" onClick={() => setAttempt(n => n + 1)}>{sv ? "Försök igen" : "Try again"}</button>}</div> : <>
        <div className="local-table-scroll"><table className="local-table"><thead><tr><th>{sv ? "Kandidat" : "Candidate"}</th><th>{sv ? "Personröster" : "Personal votes"}</th><th>{sv ? "Andel av partiets röster" : "Share of party votes"}</th><th>{sv ? "5 %-spärr" : "5% threshold"}</th></tr></thead><tbody>{(all || search ? candidates : candidates.slice(0, 10)).map(c => <tr key={`${c.partyCode}:${c.id}`}><th>{c.name}{selection.party === "OTHER" && <small className="local-candidate-party">{c.partyName}</small>}</th><td>{f(c.votes)}</td><td>{personalShare(c) === null ? "—" : `${f(personalShare(c)!, 2)}%`}</td><td>{clearsPersonalThreshold(c) ? (sv ? "Uppnådd" : "Reached") : "—"}</td></tr>)}</tbody></table></div>
        {!candidates.length && <p>{sv ? "Inga kandidater matchar urvalet." : "No candidates match the selection."}</p>}
        {candidates.length > 10 && !search && <button className="button local-show-all" type="button" onClick={() => setAll(!all)}>{all ? (sv ? "Visa de 10 främsta" : "Show the top 10") : `${sv ? "Visa alla" : "Show all"} ${f(candidates.length)}`}</button>}
      </>}
      <p className="local-note">{sv ? "Andelen använder partiets samtliga giltiga röster i valkretsen, inklusive godkända utlandsröster. Personröster från kandidatens olika valsedelslistor är summerade. Att nå 5 % är ingen garanti för ett mandat." : "The denominator is all valid party votes in the constituency, including accepted overseas votes. A candidate's personal votes across ballot lists are combined. Reaching 5% does not guarantee a seat."}</p>
      <a className="local-source-link" href="https://www.val.se/det-svenska-valsystemet/rostrakning-och-mandatfordelning/sa-utses-ledamoter" target="_blank" rel="noreferrer">{sv ? "Valmyndigheten: så fungerar personval" : "Valmyndigheten: personal-vote rules"} ↗</a>
    </>}
  </section>;
}
