"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocale } from "@/components/localize";
import { PartyMark } from "@/components/party-mark";
import { PARTIES, PARTY_ORDER } from "@/lib/parties";
import type { PartyId } from "@/lib/data/elections/types";
import { LOCAL_YEARS, type LocalArea, type LocalDistrictPayload, type LocalIndexModel, type LocalMap, type LocalYear, type LocalObservation } from "@/lib/data/geography/local-types";
import { localSwing, localVoteChange, localTurnout, voteShare } from "@/lib/data/geography/local-math";
import { localSelectionQuery, readLocalSelection, type LocalSelection } from "@/lib/data/geography/local-selection";
import { validateDistrictPayload } from "@/lib/data/geography/local-validation";
import { localCopy, type LocalCopy } from "./local-copy";
import { navigateLocalQuery, useLocalQuery } from "./local-url";
import { LocalPersonalVotes } from "./local-personal-votes";
import { usePublishSiteLocation } from "@/components/site-location";

import { VoteDelta } from "@/components/candidates/shared";

function AreaVoteDelta({area,party,year,compact=false}: {area:LocalArea;party:PartyId;year:LocalYear;compact?:boolean}) {
  const change=localVoteChange(area,party,year);
  return <VoteDelta compact={compact} comparison={{...change,previous:null,sharePoints:localSwing(area,party,year),reason:change.delta===null?"no-baseline":change.percent===null?"zero-baseline":"comparable"}}/>;
}

type NumberFormat = (n: number | null | undefined, digits?: number) => string;
function metricValue(area: LocalArea, s: LocalSelection) {
  const result = area.results.find(r => r.year === s.year);
  return s.metric === "swing" ? localSwing(area, s.party, s.year) : s.metric === "turnout" ? localTurnout(result) : voteShare(result, s.party);
}
function nameFor(area: LocalArea, t: LocalCopy) { return area.level === "national" ? t.country : area.level === "collection" ? t.collection : area.name; }
function useDistrictData(code: string, attempt: number, expected?: LocalObservation) {
  const [state, setState] = useState<{ code: string; data?: LocalDistrictPayload; error?: boolean }>({ code: "" });
  useEffect(() => {
    if (!code) return;
    const controller = new AbortController(); let active = true;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/elections/local/municipalities/${code}.json`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("District response failed"); return response.json(); })
      .then((data: unknown) => { validateDistrictPayload(data, code, expected); if (active) setState({ code, data }); })
      .catch(() => { if (active) setState({ code, error: true }); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [code, attempt, expected]);
  return state.code === code ? state : { code };
}

function LocalShapeMap({ map, areas, selection, selected, onSelect, t, f }: { map: LocalMap; areas: LocalArea[]; selection: LocalSelection; selected: string; onSelect: (area: LocalArea) => void; t: LocalCopy; f: NumberFormat }) {
  const byCode = new Map(areas.map(a => [a.code, a]));
  const values = areas.map(a => metricValue(a, selection)).filter((v): v is number => v !== null);
  const min = selection.metric === "swing" ? -Math.max(0.01, ...values.map(Math.abs)) : Math.min(0, ...values);
  const max = Math.max(0.01, ...values.map(v => selection.metric === "swing" ? Math.abs(v) : v));
  const color = selection.metric === "turnout" ? "#1c5170" : PARTIES[selection.party].color;
  function fill(value: number | null) {
    if (value === null) return "url(#local-missing)";
    if (selection.metric === "swing") return value < 0 ? `color-mix(in srgb, #a34b43 ${15 + Math.abs(value / min) * 80}%, #f4f6f8)` : `color-mix(in srgb, #1c5170 ${15 + value / max * 80}%, #f4f6f8)`;
    return `color-mix(in srgb, ${color} ${12 + (value - min) / (max - min) * 85}%, #f4f6f8)`;
  }
  return <div className="local-map-box">
    <div className="local-map-legend"><span>{f(min, 1)}{selection.metric === "swing" ? " pp" : "%"}</span><i style={{ background: `linear-gradient(90deg, ${fill(min)}, ${fill(max)})` }} /><span>{f(max, 1)}{selection.metric === "swing" ? " pp" : "%"}</span></div>
    <svg className="local-map" viewBox={map.viewBox} aria-label={t.map} role="group">
      <defs><pattern id="local-missing" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#eee" /><path d="M0 0L6 6" stroke="#bcc6cd" strokeWidth="1" /></pattern></defs>
      {map.areas.map(path => {
        const area = byCode.get(path.code); if (!area) return null;
        const value = metricValue(area, selection); const description = `${nameFor(area, t)}: ${value === null ? t.missing : `${f(value, 2)} ${selection.metric === "swing" ? t.pp : "%"}`}`;
        return <path key={path.code} d={path.path} fill={fill(value)} className={`local-map-shape${path.code === selected ? " is-selected" : ""}`} role="button" tabIndex={0} aria-label={`${t.open} ${description}`} aria-pressed={path.code === selected} onClick={() => onSelect(area)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(area); } }}><title>{description}</title></path>;
      })}
    </svg>
    <p className="local-map-help">{t.mapHelp}</p><p className="local-map-help"><span className="local-missing-key" />{t.missing}</p>
  </div>;
}

function History({ area, party, t, f, color }: { area: LocalArea; party: PartyId; t: LocalCopy; f: NumberFormat; color: string }) {
  const values = area.results.map(r => ({ year: r.year, share: voteShare(r, party), result: r }));
  const max = Math.max(10, ...values.map(v => v.share ?? 0)) * 1.15;
  const x = (year: number) => 38 + (year - 2010) / 12 * 420; const y = (share: number) => 145 - share / max * 119;
  return <section className="local-history">
    <h3>{t.history}</h3>
    <svg viewBox="0 0 500 190" role="img" aria-label={`${t.history}: ${values.map(v => `${v.year}: ${f(v.share, 2)}%`).join(", ")}`}>
      {[0, max / 2, max].map(v => <g key={v}><line x1="38" x2="466" y1={y(v)} y2={y(v)} stroke="#dfe5e9" /><text x="30" y={y(v) + 4} textAnchor="end">{f(v, 0)}%</text></g>)}
      {values.length > 1 && <polyline points={values.filter(v => v.share !== null).map(v => `${x(v.year)},${y(v.share!)}`).join(" ")} fill="none" stroke={color} strokeWidth="3" />}
      {LOCAL_YEARS.map(year => <text key={year} x={x(year)} y="178" textAnchor="middle">{year}</text>)}
      {values.filter(v => v.share !== null).map(v => <g key={v.year}><circle cx={x(v.year)} cy={y(v.share!)} r="4.5" fill={color} /><text x={x(v.year)} y={y(v.share!) - 11} textAnchor="middle" className="local-history-value">{f(v.share, 2)}%</text></g>)}
    </svg>
    <div className="local-table-scroll"><table className="local-table"><thead><tr><th>{t.year}</th><th>{t.votes}</th><th>{t.change}</th><th>{t.share}</th><th>{t.turnout}</th></tr></thead><tbody>{values.map(v => <tr key={v.year}><th>{v.year}</th><td>{f(v.result.votes[party])}</td><td><AreaVoteDelta area={area} party={party} year={v.year}/></td><td>{f(v.share, 2)}%</td><td>{localTurnout(v.result) === null ? "—" : `${f(localTurnout(v.result), 2)}%`}</td></tr>)}</tbody></table></div>
    {area.comparison?.status === "not-comparable" && <p className="local-notice">{area.comparison.reason === "shared-baseline" ? t.sharedBaseline : t.comparisonMissing}</p>}
    {area.comparison?.status === "comparable" && <p className="local-note">{t.comparison}: {area.comparison.previousNames.map((name, i) => `${name} (${area.comparison!.previousCodes[i]})`).join(" + ")}.{area.comparison.previousCodes.length > 1 && ` ${t.combined}.`}</p>}
  </section>;
}

function AreaProfile({ area, parent, selection, t, f, onParty }: { area: LocalArea; parent: LocalArea | undefined; selection: LocalSelection; t: LocalCopy; f: NumberFormat; onParty: (party: PartyId) => void }) {
  const result = area.results.find(r => r.year === selection.year); const party = PARTIES[selection.party];
  const share = voteShare(result, selection.party); const parentShare = voteShare(parent?.results.find(r => r.year === selection.year), selection.party);
  const delta = localSwing(area, selection.party, selection.year);
  return <article className="local-profile" aria-label={nameFor(area, t)}>
    <span className="mini-label">{t.official} · {selection.year}</span><h2>{nameFor(area, t)}</h2>
    <p className="local-area-code">{area.level === "collection" ? t.collection : area.level === "district" ? t.district : area.level === "municipality" ? t.municipality : area.level === "county" ? t.county : t.national}{area.code !== "SE" && ` · ${area.code}`}</p><p className="local-note" data-classification="DERIVED">{t.derived}</p>
    <div className="local-party-title">{selection.party !== "OTHER" && <PartyMark party={party} />}<strong>{selection.party === "OTHER" ? t.other : party.name}</strong></div>
    {result ? <>
      <div className="local-main-value">{f(share, 2)}<span>%</span></div>
      <p className="local-note">{f(result.votes[selection.party])} / {f(result.validVotes)} {t.validVotes.toLowerCase()}</p>
      <dl className="local-metrics"><div><dt>{t.change} · {selection.year-4} → {selection.year}</dt><dd><AreaVoteDelta area={area} party={selection.party} year={selection.year}/></dd></div><div><dt>{t.swing} · {selection.year-4} → {selection.year}</dt><dd>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${f(delta, 2)} pp`}</dd></div><div><dt>{t.turnout}</dt><dd>{localTurnout(result) === null ? "—" : `${f(localTurnout(result), 2)}%`}</dd></div><div><dt>{t.eligible}</dt><dd>{result.eligibleVoters ? f(result.eligibleVoters) : t.noTurnout}</dd></div><div><dt>{t.totalVotes}</dt><dd>{f(result.totalVotes)}</dd></div></dl>
      {parent && share !== null && parentShare !== null && <p className="local-note">{t.parentDifference} {nameFor(parent, t)}: <strong>{share - parentShare > 0 ? "+" : ""}{f(share - parentShare, 2)} {t.pp}</strong></p>}
    </> : <p className="local-notice">{t.unavailable}</p>}
    {area.level === "collection" && <p className="local-notice">{t.collectionNote}</p>}
    <History area={area} party={selection.party} t={t} f={f} color={party.color} />
    {result && <details className="local-details"><summary>{t.allParties}</summary><table className="local-table"><thead><tr><th>{t.party}</th><th>{t.votes}</th><th>{t.change}</th><th>{t.share}</th></tr></thead><tbody>{[...PARTY_ORDER].sort((a, b) => result.votes[b] - result.votes[a]).map(p => <tr key={p}><th><button type="button" onClick={() => onParty(p)} aria-label={p === "OTHER" ? t.other : PARTIES[p].name}><PartyMark party={PARTIES[p]} size="sm" label={p === "OTHER" ? t.other : undefined}/></button></th><td>{f(result.votes[p])}</td><td><AreaVoteDelta area={area} party={p} year={selection.year} compact/></td><td>{f(voteShare(result, p), 2)}%</td></tr>)}</tbody></table></details>}
  </article>;
}

function AreaList({ areas, selection, selected, onSelect, t, f }: { areas: LocalArea[]; selection: LocalSelection; selected: string; onSelect: (area: LocalArea) => void; t: LocalCopy; f: NumberFormat }) {
  const [search, setSearch] = useState(""); const [sort, setSort] = useState("strongest");
  const filtered = useMemo(() => areas.filter(a => `${nameFor(a, t)} ${a.code}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "sv");
    const av = metricValue(a, selection), bv = metricValue(b, selection);
    if (av === null || bv === null) return av === bv ? a.code.localeCompare(b.code) : av === null ? 1 : -1;
    return (sort === "weakest" ? av - bv : bv - av) || a.code.localeCompare(b.code);
  }), [areas, search, sort, selection, t]);
  return <section className="local-area-list"><div className="local-section-title"><h2>{t.list}</h2><span>{f(filtered.length)} {t.count}</span></div>
    <div className="local-list-controls"><label>{t.search}<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label><label>{t.sort}<select value={sort} onChange={e => setSort(e.target.value)}><option value="strongest">{t.strongest}</option><option value="weakest">{t.weakest}</option><option value="name">{t.alphabetical}</option></select></label></div>
    <div className="local-table-scroll"><table className="local-table local-area-table"><thead><tr><th>{t.area}</th><th>{selection.metric === "swing" ? t.swing : selection.metric === "turnout" ? t.turnout : t.share}</th><th>{t.votes}</th><th>{t.change}</th><th>{t.turnout}</th></tr></thead><tbody>{filtered.map(area => {
      const v = metricValue(area, selection); const r = area.results.find(r => r.year === selection.year);
      return <tr key={area.code} className={selected === area.code ? "is-selected" : ""}><th><button type="button" onClick={() => onSelect(area)} aria-label={`${t.open} ${nameFor(area, t)}`}>{nameFor(area, t)}<span aria-hidden="true">→</span><small>{area.code}</small></button></th><td>{v === null ? "—" : `${selection.metric === "swing" && v > 0 ? "+" : ""}${f(v, 2)}${selection.metric === "swing" ? " pp" : "%"}`}</td><td>{r ? f(r.votes[selection.party]) : "—"}</td><td><AreaVoteDelta area={area} party={selection.party} year={selection.year} compact/></td><td>{localTurnout(r) === null ? "—" : `${f(localTurnout(r), 2)}%`}</td></tr>;
    })}</tbody></table></div>{!filtered.length && <p>{t.noMatches}</p>}
  </section>;
}

export function LocalElectionExplorer({ model }: { model: LocalIndexModel }) {
  const locale = useLocale(); const t = localCopy(locale); const query = useLocalQuery(); const selection = readLocalSelection(query, model);
  const f: NumberFormat = (n, digits = 0) => n === null || n === undefined ? "—" : new Intl.NumberFormat(locale === "sv" ? "sv-SE" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  const [attempt, setAttempt] = useState(0); const [copyState, setCopyState] = useState("");
  const districtState = useDistrictData(selection.municipality, attempt, model.municipalities.find(m => m.code === selection.municipality)?.results.find(r => r.year === 2022));
  const county = model.counties.find(a => a.code === selection.county); const municipality = model.municipalities.find(a => a.code === selection.municipality);
  const district = districtState.data?.areas.find(a => a.code === selection.district);
  const selectedArea = district ?? municipality ?? county ?? model.national;
  const parent = district ? municipality : municipality ? county : county ? model.national : undefined;
  const children = municipality ? districtState.data?.areas ?? [] : county ? model.municipalities.filter(m => m.parent === county.code) : model.counties;
  const map = municipality ? districtState.data?.map : county ? model.countyMaps[county.code] : model.map;
  usePublishSiteLocation("/maps", query, [
    ...(county ? [{ label: county.name, href: `/maps${localSelectionQuery({ ...selection, municipality: "", district: "", constituency: "", candidate: "" })}` }] : []),
    ...(municipality ? [{ label: municipality.name, href: `/maps${localSelectionQuery({ ...selection, district: "", constituency: "", candidate: "" })}` }] : []),
    ...(district ? [{ label: nameFor(district, t), href: `/maps${localSelectionQuery(selection)}` }] : []),
  ]);
  function update(patch: Partial<LocalSelection>) {
    const geographyChanged = (["county", "municipality", "district"] as const).some(key => patch[key] !== undefined && patch[key] !== selection[key]);
    const candidateScopeChanged = geographyChanged || patch.party !== undefined && patch.party !== selection.party || patch.constituency !== undefined && patch.constituency !== selection.constituency || patch.year !== undefined && patch.year !== selection.year;
    navigateLocalQuery(localSelectionQuery({ ...selection, ...(geographyChanged ? { constituency: "" } : {}), ...(candidateScopeChanged ? { candidate: "" } : {}), ...patch })); setCopyState("");
  }
  function choose(area: LocalArea) {
    if (area.level === "county") update({ county: area.code, municipality: "", district: "" });
    else if (area.level === "municipality") update({ county: area.parent!, municipality: area.code, district: "" });
    else update({ district: area.code });
    requestAnimationFrame(() => document.querySelector(area.level === "district" || area.level === "collection" ? ".local-profile" : ".local-workspace")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  }
  const activeYear = selection.year;
  return <div className="local-explorer" id="local-results" style={{ "--local-party": PARTIES[selection.party].color } as CSSProperties}>
    <p className="local-election-scope">{t.historicalElection}</p>
    <div className="local-filters">
      <label>{t.county}<select value={selection.county} onChange={e => update({ county: e.target.value, municipality: "", district: "" })}><option value="">{t.country}</option>{model.counties.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
      <label>{t.municipality}<select value={selection.municipality} onChange={e => { const m = model.municipalities.find(m => m.code === e.target.value); update({ municipality: m?.code ?? "", county: m?.parent ?? selection.county, district: "" }); }}><option value="">{county ? t.countyOverview : t.allMunicipalities}</option>{model.municipalities.filter(m => !county || m.parent === county.code).map(m => <option value={m.code} key={m.code}>{m.name}</option>)}</select></label>
      <label>{t.year}<select value={activeYear} onChange={e => update({ year: Number(e.target.value) as LocalYear })}>{LOCAL_YEARS.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
      <label>{t.metric}<select value={selection.metric} onChange={e => update({ metric: e.target.value as LocalSelection["metric"] })}><option value="share">{t.share}</option><option value="swing">{t.swing}</option><option value="turnout">{t.turnout}</option></select></label>
    </div>
    <div className="local-party-picker" aria-label={t.selectParty}>{PARTY_ORDER.map(p => <button type="button" key={p} aria-pressed={selection.party === p} onClick={() => update({ party: p })} aria-label={p === "OTHER" ? t.other : PARTIES[p].name}><PartyMark party={PARTIES[p]} size="sm" label={p === "OTHER" ? t.other : undefined}/></button>)}</div>
    <nav className="local-breadcrumbs" aria-label={t.area}><button type="button" onClick={() => update({ county: "", municipality: "", district: "" })}>{t.country}</button>{county && <><span>/</span><button type="button" onClick={() => update({ municipality: "", district: "" })}>{county.name}</button></>}{municipality && <><span>/</span><button type="button" onClick={() => update({ district: "" })}>{municipality.name}</button></>}{district && <><span>/</span><strong>{nameFor(district, t)}</strong></>}</nav>
    {selection.district && districtState.data && !district && <p className="local-notice">{t.missingDistrict}</p>}
    <div className="local-workspace"><div className="local-map-column"><div className="local-section-title"><h2>{municipality ? t.districts : county ? t.municipalities : t.counties}</h2><span>{selection.metric === "swing" ? `${selection.year-4} → ${selection.year}` : activeYear}</span></div>
      {map ? <LocalShapeMap map={map} areas={children} selection={selection} selected={district?.code ?? ""} onSelect={choose} t={t} f={f} /> : <div className="local-map-placeholder" role="status"><p>{districtState.error ? t.error : t.loading}</p>{districtState.error && <button type="button" className="button" onClick={() => setAttempt(n => n + 1)}>{t.retry}</button>}</div>}
      <p className="local-note">{t.availability}</p>
    </div><AreaProfile area={selectedArea} parent={parent} selection={selection} t={t} f={f} onParty={party => update({ party })} /></div>
    <LocalPersonalVotes key={`${selection.year}:${selection.county}:${selection.municipality}:${selection.district}:${selection.constituency}:${selection.party}:${selection.candidate ?? ""}`} area={selectedArea} county={county} municipality={municipality} selection={selection} constituencies={model.constituencies} onConstituency={constituency => update({ constituency })} />
    {children.length > 0 && <AreaList key={selection.municipality || selection.county || "SE"} areas={children} selection={selection} selected={district?.code ?? ""} onSelect={choose} t={t} f={f} />}
    <div className="local-share"><button className="button" type="button" onClick={() => navigator.clipboard.writeText(window.location.href).then(() => setCopyState(t.copied)).catch(() => setCopyState(t.copyFailed))}>{t.shareLink}</button><span role="status">{copyState}</span><a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/elections/local/${municipality ? `municipalities/${municipality.code}.json` : "index.json"}`}>{t.readData} ↗</a></div>
    <details className="local-details local-method"><summary>{t.source}</summary><p>{t.method}</p><p>{t.geometry}</p><p>{t.historyNote}</p><a href="https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022" target="_blank" rel="noreferrer">{t.sourceLink} ↗</a><p>{t.inspected}: {model.source.retrievedAt} · {model.source.methodVersion}</p></details>
    <aside className="local-live-note"><p>{t.liveNote}</p><a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${locale === "en" ? "/en" : ""}/valnatt/`}>{t.live} →</a></aside>
  </div>;
}
