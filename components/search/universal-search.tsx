"use client";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "../localize";
import { useLocalQuery, navigateLocalQuery } from "../maps/local-url";
import { localizedHref } from "@/lib/i18n/translate";
import { SEARCH_TYPES, type SearchEntry, type SearchType } from "@/lib/search/types";
import { normalizeSearch, prepareSearch, preferredSearchLink, searchEntries, validateSearchIndex } from "@/lib/search/engine";
import { prepareCandidateSearch } from "@/lib/candidates/search";
import { SearchIcon } from "./search-trigger";
import { PartyText } from "../party-label";

const labels: Record<SearchType, [string, string]> = {
  person: ["Personer", "People"], party: ["Partier", "Parties"], county: ["Län", "Counties"], municipality: ["Kommuner", "Municipalities"], locality: ["Orter", "Localities"], district: ["Valdistrikt & röstgrupper", "Districts & vote groups"], constituency: ["Valkretsar", "Constituencies"], page: ["Sidor", "Pages"], election: ["Val", "Elections"], topic: ["Ämnen & metoder", "Topics & methods"], source: ["Källor", "Sources"],
};
type PreparedIndex = ReturnType<typeof prepareSearch>;
let accepted: PreparedIndex | undefined;
const emptyIndex: PreparedIndex = [];

function SearchResult({ entry, query }: { entry: SearchEntry; query: string }) {
  const locale = useLocale(); const sv = locale === "sv";
  const preferred = preferredSearchLink(entry, query);
  const href = localizedHref(preferred?.href ?? entry.href, locale);
  const politicalCopy = entry.type === "party" || entry.type === "topic";
  return <li className="search-result">
    <div className="search-result__kind">{labels[entry.type][sv ? 0 : 1]}</div>
    <h2><Link href={href} prefetch={false}><span className="search-result__title">{politicalCopy ? <PartyText>{entry.title[locale]}</PartyText> : entry.title[locale]}</span><span aria-hidden="true">↗</span></Link></h2>
    <p>{politicalCopy ? <PartyText>{entry.description[locale]}</PartyText> : entry.description[locale]}</p>
    {preferred && <Link className="search-result__destination" href={href} prefetch={false}>{preferred.title[locale]} →</Link>}
    {entry.links && entry.links.length > 1 && <details><summary>{sv ? "Visa alla" : "Show all"} {entry.links.length} {entry.type === "locality" ? (sv ? "kommuner" : "municipalities") : (entry.type === "person" ? (sv ? "valområden" : "election areas") : (sv ? "valkretsar" : "constituencies"))}</summary><ul>{entry.links.map(link => <li key={link.href}><Link href={localizedHref(link.href, locale)} prefetch={false}>{link.title[locale]} →</Link></li>)}</ul></details>}
  </li>;
}

export function UniversalSearch() {
  const locale = useLocale(); const sv = locale === "sv";
  const queryString = useLocalQuery(); const params = new URLSearchParams(queryString);
  const query = (params.get("q") ?? "").slice(0, 160);
  const rawType = params.get("type") as SearchType;
  const type = SEARCH_TYPES.includes(rawType) ? rawType : "all";
  const page = Math.max(1, Math.min(1000, Number(params.get("page")) || 1));
  const deferred = useDeferredValue(query);
  const [index, setIndex] = useState<PreparedIndex | undefined>(undefined);
  const [error, setError] = useState(false); const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const f = (n: number) => n.toLocaleString(sv ? "sv-SE" : "en-GB");
  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const load = async () => {
      if (accepted) return accepted;
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/search/index.json`, { signal: controller.signal });
      if (!response.ok) throw new Error("Search response failed");
      const data: unknown = await response.json(); validateSearchIndex(data);
      const candidates = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/candidates/search.json`, {signal:controller.signal});
      if (!candidates.ok) throw new Error("Candidate search response failed");
      const candidateIndex = await prepareCandidateSearch(await candidates.json(), controller.signal);
      const combined = [...prepareSearch(data.entries), ...candidateIndex];
      controller.signal.throwIfAborted(); accepted = combined; return combined;
    };
    load().then(data => { if (active) { setIndex(data); setError(false); } }).catch(() => { if (active) setError(true); }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  const result = useMemo(() => searchEntries(index ?? emptyIndex, deferred, type), [index, deferred, type]);
  const hasQuery = normalizeSearch(query).length > 0;
  const totalPages = Math.max(1, Math.ceil(result.hits.length / 24));
  const currentPage = Math.min(Math.floor(page), totalPages);
  function update(values: { q?: string; type?: string; page?: number }, replace = false) {
    const next = new URLSearchParams();
    const nextQuery = values.q ?? query; const nextType = values.type ?? type;
    if (nextQuery) next.set("q", nextQuery.slice(0, 160));
    if (nextType !== "all") next.set("type", nextType);
    if (values.page && values.page > 1) next.set("page", String(values.page));
    navigateLocalQuery(next.size ? `?${next}` : "", replace);
  }
  function paginate(next: number) {
    update({ page: next });
    requestAnimationFrame(() => document.getElementById("search-results-title")?.focus());
  }
  return <div className="universal-search">
    <section className="search-hero"><div className="search-container"><p className="eyebrow eyebrow--light">Politicalverse · {sv ? "Sök" : "Search"}</p><h1>{sv ? "Hela Politicalverse." : "All of Politicalverse."}<br /><em>{sv ? "En sökning." : "One search."}</em></h1>
      <form role="search" onSubmit={event => { event.preventDefault(); update({}); inputRef.current?.blur(); }}>
        <label htmlFor="universal-search-input">{sv ? "Sök på hela sajten" : "Search the entire site"}</label>
        <div className="search-input-wrap"><SearchIcon /><input id="universal-search-input" ref={inputRef} type="search" autoComplete="off" maxLength={160} value={query} onChange={event => update({ q: event.target.value }, true)} placeholder={sv ? "Person, kommun, ort, parti eller ämne…" : "Person, municipality, locality, party or topic…"} aria-describedby="search-help" /><button type="submit">{sv ? "Sök" : "Search"}</button></div>
      </form>
      <p id="search-help">{sv ? "Sök med eller utan å, ä och ö. Flera ord preciserar sökningen." : "Search with or without Swedish accents. Add words to narrow your search."}</p>
    </div></section>
    <div className="search-container search-workspace">
      <aside className="search-filters"><h2>{sv ? "Visa" : "Show"}</h2><label className="search-filter-select">{sv ? "Filtrera sökresultat" : "Filter search results"}<select value={type} onChange={event => update({ type: event.target.value })}>{(["all", ...SEARCH_TYPES] as const).map(item => <option key={item} value={item}>{item === "all" ? (sv ? "Allt" : "Everything") : labels[item][sv ? 0 : 1]}{hasQuery && index ? ` (${f(item === "all" ? result.total : result.counts[item])})` : ""}</option>)}</select></label><div className="search-filter-buttons" role="group" aria-label={sv ? "Filtrera sökresultat" : "Filter search results"}>
        {(["all", ...SEARCH_TYPES] as const).map(item => <button type="button" key={item} aria-pressed={type === item} onClick={() => update({ type: item })}><span>{item === "all" ? (sv ? "Allt" : "Everything") : labels[item][sv ? 0 : 1]}</span>{hasQuery && index && <span className="search-filter-count">{f(item === "all" ? result.total : result.counts[item])}</span>}</button>)}
      </div></aside>
      <section className="search-results" aria-busy={!index && !error || deferred !== query}>
        {!index ? <div className="search-state" role={error ? "alert" : "status"}><h2>{error ? (sv ? "Sökningen kunde inte laddas" : "Search could not be loaded") : (sv ? "Förbereder sökningen…" : "Preparing search…")}</h2>{error && <><p>{sv ? "Försök igen. Du kan fortfarande använda sajtens vanliga meny." : "Try again. You can still use the site's navigation."}</p><button className="button" type="button" onClick={() => { setError(false); setAttempt(n => n + 1); }}>{sv ? "Försök igen" : "Try again"}</button></>}</div> : !hasQuery ? <div className="search-start"><h2>{sv ? "Vad vill du utforska?" : "What would you like to explore?"}</h2><p>{sv ? "Hitta rätt bland personer, orter, valresultat, prognoser och metoder." : "Find people, places, election results, forecasts and methods."}</p><div className="search-examples">{["Borås", "Fritsla", "Magdalena Andersson", sv ? "Personröster" : "Personal votes", "2018"].map(example => <button type="button" key={example} onClick={() => update({ q: example, type: "all" })}><SearchIcon />{example}</button>)}</div></div> : <>
          <div className="search-results-heading"><h2 id="search-results-title" tabIndex={-1}>{sv ? "Sökresultat" : "Search results"}</h2><p role="status" aria-live="polite">{f(result.hits.length)} {sv ? (result.hits.length === 1 ? "träff" : "träffar") : (result.hits.length === 1 ? "result" : "results")}{type !== "all" && ` · ${labels[type][sv ? 0 : 1]}`}</p></div>
          {result.approximate && <p className="search-notice">{sv ? "Inga exakta träffar. Här visas namn med liknande stavning." : "No exact matches. Showing names with similar spelling."}</p>}
          {!result.hits.length ? <div className="search-state"><h3>{sv ? "Inga träffar i urvalet" : "No results in this selection"}</h3><p>{sv ? "Prova färre ord, ett annat namn eller välj Allt. Sökningen omfattar det inlästa materialet." : "Try fewer words, another name or select Everything. Search covers the imported material."}</p>{type !== "all" && <button className="button" type="button" onClick={() => update({ type: "all" })}>{sv ? "Sök i allt" : "Search everything"}</button>}</div> : <ul className="search-result-list">{result.hits.slice((currentPage - 1) * 24, currentPage * 24).map(hit => <SearchResult key={hit.entry.id} entry={hit.entry} query={deferred} />)}</ul>}
          {totalPages > 1 && <nav className="search-pagination" aria-label={sv ? "Sökresultatens sidor" : "Search result pages"}><button className="button" disabled={currentPage === 1} onClick={() => paginate(currentPage - 1)}>{sv ? "Föregående" : "Previous"}</button><span>{currentPage} / {totalPages}</span><button className="button" disabled={currentPage === totalPages} onClick={() => paginate(currentPage + 1)}>{sv ? "Nästa" : "Next"}</button></nav>}
        </>}
      </section>
    </div>
    <div className="search-container search-coverage"><details><summary>{sv ? "Vad ingår i sökningen?" : "What does search cover?"}</summary><p>{sv ? "Sajtens sidor och innehåll, partier, val, daterad regeringskontext, personröstkandidater och valområden från riksdags-, region- och kommunvalen 2010–2022, 21 län, 290 kommuner, valdistrikt och uppsamlingsröster samt SCB:s 2 017 tätorter från 2023. Tätortsnamnen uppdaterades av SCB 24 november 2025." : "Site pages and content, parties, elections, dated government context, personal-vote candidates and areas from the 2010–2022 Riksdag, regional and municipal elections, 21 counties, 290 municipalities, districts and collection votes, plus Statistics Sweden's 2,017 urban localities from 2023. SCB updated the locality names on 24 November 2025."}</p><p>{sv ? "Orter och valdistrikt är olika geografiska områden. Ortträffar öppnar den eller de berörda kommunernas valresultat. Personröstträffar avser 2010–2022 och är inte en lista över kandidaturer 2026. Småorter saknar namn i SCB:s aktuella register; lokala namn kan ändå hittas i valdistriktsnamnen." : "Localities and electoral districts are different geographic areas. Locality results open the relevant municipalities' election results. Personal-vote results refer to 2010–2022 and are not a list of 2026 candidacies. SCB's current smaller-locality register has no names; local names may still be found in electoral district names."}</p><a href="https://www.scb.se/hitta-statistik/statistik-efter-amne/boende-bebyggelse-och-mark/bebyggelseomraden/tatorter-och-smaorter/" target="_blank" rel="noreferrer">{sv ? "SCB: tätorter och småorter" : "Statistics Sweden: localities"} ↗</a></details></div>
  </div>;
}
