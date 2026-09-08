"use client";
import Link from "next/link";
import { useLocale } from "../localize";
import { useLocalQuery, navigateLocalQuery } from "../maps/local-url";
import { localizedHref } from "@/lib/i18n/translate";
import { personShard, type CandidateResult } from "@/lib/candidates/types";
import { RANKING_METRICS, rankingLabel, standingLabel } from "@/lib/candidates/leaderboards";
import { standingsHref, validateStandings, type StandingScope } from "@/lib/candidates/standings";
import { validateCatalog } from "@/lib/candidates/validation";
import { CandidateLoading, electionLabel, partyLabel, useCandidateResource } from "./shared";

export function ProfileStandings({ person, results, sourceVersion, initialYear }: { person: string; results: CandidateResult[]; sourceVersion: string; initialYear: number }) {
  const locale = useLocale(), sv = locale === "sv";
  const query = useLocalQuery(), params = new URLSearchParams(query);
  const years = [...new Set(results.map(r => r.year))].sort((a, b) => b - a);
  const chosenYear = Number(params.get("year")) || initialYear, chosenParty = params.get("standingParty") ?? "", partyOnly = params.get("peers") === "party" ? 1 : 0;
  function update(values: Record<string, string>) { const next = new URLSearchParams(query); for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); } navigateLocalQuery(`?${next}`); }
  const year = years.find(y => y === chosenYear) ?? years[0];
  const candidacies = results.filter(r => r.year === year);
  const selected = candidacies.find(r => r.partyCode === chosenParty) ?? candidacies[0];
  const state = useCandidateResource(`standings-v1/${personShard(person)}.json`, validateStandings);
  const catalogState = useCandidateResource("index.json", validateCatalog), catalog = catalogState.data;
  const valid = state.data?.sourceVersion === sourceVersion && Object.hasOwn(state.data.people, person) && catalog?.version === sourceVersion;
  const record = valid ? state.data!.people[person]?.find(r => r.year === year && r.election === selected.electionType && r.area === selected.areaCode && r.party === selected.partyCode) : undefined;
  const countyName = catalog?.counties.find(c => c.code === selected.county)?.name;
  const scopes: { key: StandingScope; label: string; name: string }[] = [
    { key: "national", label: sv ? "Sverige" : "Sweden", name: sv ? "Hela Sverige" : "All Sweden" },
    ...(selected.electionType !== "RF" ? [{ key: "county" as const, label: sv ? "Länet" : "County", name: countyName ?? selected.county }] : []),
    { key: "area", label: selected.electionType === "KF" ? (sv ? "Kommunen" : "Municipality") : selected.electionType === "RF" ? (sv ? "Regionen" : "Region") : (sv ? "Valkretsen" : "Constituency"), name: selected.areaName },
  ];
  const metrics = RANKING_METRICS.filter(m => record?.ranks.some(r => r[0] === m && r[2] === partyOnly));
  return <section className="profile-standings" aria-labelledby="profile-standings-title" data-classification="DERIVED">
    <div className="profile-standings-heading"><div><span className="mini-label">{sv ? "I TOPPLISTORNA" : "ON THE LEADERBOARDS"}</span><h2 id="profile-standings-title">{sv ? "Placeringar" : "Rankings"}</h2></div><span className="profile-standings-context">{electionLabel(selected.electionType, sv)} · {selected.areaName}</span></div>
    <div className="profile-standings-controls">
      <label>{sv ? "Valår" : "Election year"}<select value={year} onChange={e => update({year:e.target.value,standingParty:""})}>{years.map(y => <option key={y}>{y}</option>)}</select></label>
      {candidacies.length > 1 && <label>{sv ? "Kandidatur" : "Candidacy"}<select value={selected.partyCode} onChange={e => update({standingParty:e.target.value})}>{candidacies.map(r => <option key={r.partyCode} value={r.partyCode}>{partyLabel(r, sv)}</option>)}</select></label>}
      <label>{sv ? "Jämför med" : "Compare with"}<select value={partyOnly} onChange={e => update({peers:e.target.value === "1" ? "party" : ""})}><option value={0}>{sv ? "Alla partier" : "All parties"}</option><option value={1}>{partyLabel(selected, sv)}</option></select></label>
    </div>
    {!valid ? <CandidateLoading error={state.error || catalogState.error || (!!state.data && !!catalog && !valid)} retry={() => { state.retry(); catalogState.retry(); }}/>
      : metrics.length ? <table className="profile-standings-table"><caption className="sr-only">{sv ? "Beräknade topplistplaceringar" : "Calculated leaderboard ranks"} · {year}</caption><thead><tr><th scope="col">{sv ? "Topplista" : "Leaderboard"}</th>{scopes.map(s => <th scope="col" key={s.key}>{s.label}</th>)}</tr></thead><tbody>{metrics.map(metric => <tr key={metric}><th scope="row">{rankingLabel(metric, sv)}</th>{scopes.map(scope => {
        const rank = record!.ranks.find(r => r[0] === metric && r[1] === scope.key && r[2] === partyOnly);
        const description = rank ? `${rankingLabel(metric, sv)} · ${scope.name} · ${year} · ${sv ? "plats" : "rank"} ${rank[3]} ${sv ? "av" : "of"} ${rank[4]} · ${partyOnly ? partyLabel(selected, sv) : sv ? "alla partier" : "all parties"}` : "";
        return <td key={scope.key}>{rank ? <Link href={localizedHref(standingsHref(person, record!, rank, selected.county), locale)} aria-label={description} title={description}>{standingLabel(rank[3], sv)}</Link> : <span aria-label={sv ? "Inte inom topp 100 eller saknat underlag" : "Outside the top 100 or unavailable"}>—</span>}</td>;
      })}</tr>)}</tbody></table> : <p className="profile-standings-empty">{sv ? "Ingen placering inom topp 100 i det här urvalet." : "No top-100 ranking for this selection."}</p>}
    <p className="profile-standings-note">{countyName && selected.electionType !== "RF" ? `${countyName} · ` : ""}{sv ? "Beräknade placeringar. Tryck på en placering för att se topplistan. Delade placeringar behålls; streck betyder utanför topp 100 eller saknat underlag." : "Calculated ranks. Select a rank to open its leaderboard. Ties share a rank; a dash means outside the top 100 or unavailable."}</p>
    {selected.electionType === "RD" && <p className="profile-standings-note">{sv ? "Flest personröster summerar kandidatens valkretsar inom varje jämförelseområde. Övriga topplistor jämför resultatet i den valda valkretsen." : "Total-vote rankings sum the candidate’s constituencies within each comparison area. Other leaderboards compare the result in the selected constituency."}</p>}
  </section>;
}
