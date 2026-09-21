import { AREA_METHOD, areaKey, type AreaFeed, type CountedArea } from "./area-types";
import { validateComparison } from "./comparison";
import { CERTIFICATE_SHA256, LIVE_ADAPTER_VERSION } from "./constants";
import { insist, integer, list, object, percent, string, matchesPercent } from "./validation";

export function validateCountedArea(value: unknown): CountedArea {
  const a = object(value, "displayed area"); string(a.name, "area name"); string(a.code, "area code");
  const valid = integer(a.validVotes, "valid votes"), total = integer(a.totalVotes, "total votes"), eligible = integer(a.eligibleInCountedDistricts, "counted electorate");
  const warnings = a.sourceWarnings === undefined ? [] : list(a.sourceWarnings, "source warnings");
  insist(new Set(warnings).size === warnings.length && warnings.every(w => ["previous-party-total", "missing-counted-electorate"].includes(String(w))), "Invalid source warning");
  const missingElectorate = warnings.includes("missing-counted-electorate") && eligible === 0 && total > 0 && integer(a.countedDistricts, "counted") > 0 && Number(a.countedDistricts) < Number(a.totalDistricts);
  insist(!warnings.includes("missing-counted-electorate") || missingElectorate, "Invalid electorate warning");
  insist(!warnings.includes("previous-party-total") || a.previous === null, "Invalid comparison warning");
  insist(valid + integer(a.invalidVotes, "invalid votes") === total && (total <= eligible || missingElectorate) && total <= integer(a.eligibleVoters, "electorate") && eligible <= Number(a.eligibleVoters), "Invalid displayed totals");
  insist(integer(a.countedDistricts, "counted districts") <= integer(a.totalDistricts, "all districts") && matchesPercent(a.turnoutInCountedDistricts, percent(total, eligible)), "Invalid displayed coverage");
  const parties = list(a.parties, "parties").map(p => object(p, "party"));
  insist(new Set(parties.map(p => p.code)).size === parties.length, "Duplicate displayed party");
  for (const p of parties) {
    insist(/^\d{4}$/.test(String(p.code)), "Invalid party identity"); string(p.name, "party name");
    const votes = integer(p.votes, "party votes"); insist(matchesPercent(p.share, percent(votes, valid)), "Invalid displayed share");
    if (p.seats !== null) integer(p.seats, "seats");
    if (p.fixedSeats !== null || p.adjustmentSeats !== null) insist(integer(p.fixedSeats, "fixed seats") + integer(p.adjustmentSeats, "adjustment seats") === p.seats, "Invalid seat components");
  }
  insist(parties.reduce((s, p) => s + (p.votes as number), integer(a.otherVotes, "other votes")) === valid, "Displayed parties do not reconcile");
  validateComparison(a.previous);
  return a as CountedArea;
}

export function validateAreaFeed(value: unknown): AreaFeed {
  const f = object(value, "area feed");
  insist(f.schemaVersion === 1 && f.methodVersion === AREA_METHOD && f.classification === "OFFICIAL" && f.electionDate === "2026-09-13", "Unsupported area feed");
  insist(typeof f.checkedAt === "string" && Number.isFinite(Date.parse(f.checkedAt)), "Invalid area check time");
  insist(["ok", "degraded"].includes(String(f.status)) && list(f.failures, "failed sources").every(v => typeof v === "string"), "Invalid area status");
  insist(f.indexSha256 === null || /^[a-f0-9]{64}$/.test(String(f.indexSha256)), "Invalid index checksum");
  const published = object(f.published, "published phases");
  for (const stage of ["preliminary", "final-count"]) for (const [type, maximum] of [["RD", 1], ["RF", 20], ["KF", 290]] as const) insist(integer(object(published[stage], "published phase")[type], "published count") <= maximum, "Invalid published coverage");
  const results = object(f.results, "area results"); insist(Object.keys(results).length <= 622, "Too many areas");
  for (const [key, value] of Object.entries(results)) {
    const r = object(value, "area result");
    insist(["preliminary", "final-count"].includes(String(r.stage)) && ["RD", "RF", "KF"].includes(String(r.electionType)), "Invalid election scope");
    const a = validateCountedArea(r.area), seats = integer(r.totalSeats, "total seats");
    insist(key === `${r.stage}/${r.electionType}/${a.code}` && seats > 0 && seats <= 501, "Wrong area key or seat structure");
    const phase = r.stage === "preliminary" ? "p" : "s", label = phase === "p" ? "preliminar" : "slutlig";
    const archive = new RegExp(`^https://resultat\\.val\\.se/resultatfiler/val2026/${phase}/${String(r.electionType).toLowerCase()}/Val_(2026|20260913)_${label}_${a.code}_${r.electionType}\\.zip$`);
    insist(r.electionType === "RD" ? a.code === "00" && seats === 349 : r.electionType === "KF" ? /^\d{4}$/.test(a.code) : /^\d{2}$/.test(a.code) && a.code !== "00", "Wrong displayed geography");
    const s = object(r.source, "area source");
    for (const source of r.summarySource === null ? [s] : [s, object(r.summarySource, "summary source")]) insist(source.adapterVersion === LIVE_ADAPTER_VERSION && source.signatureVerified === true && source.certificateSha256 === CERTIFICATE_SHA256 && /^[a-f0-9]{64}$/.test(String(source.jsonSha256)) && /^[a-f0-9]{32}$/.test(String(source.archiveMd5)) && archive.test(String(source.archiveUrl)) && source.archiveMd5 === s.archiveMd5, "Invalid signed area provenance");
    integer(r.sourceRevision, "revision"); insist(typeof r.sourceUpdatedAt === "string" && Number.isFinite(Date.parse(r.sourceUpdatedAt)), "Invalid area update time");
    insist(r.protocolUrl === null || /^https:\/\/resultat\.val\.se\/protokoll\/[^\s]+\.pdf$/.test(String(r.protocolUrl)), "Invalid area protocol");
    if (a.parties.some(p => p.seats !== null)) insist(a.parties.every(p => p.seats !== null) && a.parties.reduce((s, p) => s + (p.seats ?? 0), 0) === seats, "Invalid displayed mandates");
    const municipalities = list(r.municipalities, "municipalities").map(m => { const a = validateCountedArea(m), c = object(m, "municipality").countyCode; insist(typeof c === "string" && /^\d{2}$/.test(c) && a.code.startsWith(c) && a.code.length === 4, "Invalid municipality county"); return a; });
    insist(new Set(municipalities.map(m => m.code)).size === municipalities.length, "Duplicate displayed municipality");
    if (r.electionType === "KF") insist(municipalities.length === 0 && r.summarySource === null, "Municipal election cannot contain municipal summary");
    else {
      insist(r.summarySource !== null && municipalities.length > 0 && (r.electionType !== "RD" || municipalities.length === 290), "Missing municipal summary provenance");
      for (const k of ["validVotes", "invalidVotes", "totalVotes", "eligibleVoters", "eligibleInCountedDistricts", "countedDistricts", "totalDistricts", "otherVotes"] as const) insist(municipalities.reduce((s, m) => s + m[k], 0) === a[k], "Displayed municipal totals differ");
      for (const p of a.parties) insist(municipalities.reduce((s, m) => s + (m.parties.find(x => x.code === p.code)?.votes ?? 0), 0) === p.votes, "Displayed municipal party totals differ");
    }
  }
  return f as AreaFeed;
}

export function acceptAreaFeed(previous: AreaFeed | null, value: unknown): AreaFeed {
  const next = validateAreaFeed(value);
  if (!previous) return next;
  insist(next.checkedAt >= previous.checkedAt, "Area check time regressed");
  for (const p of Object.values(previous.results)) {
    const n = next.results[areaKey(p.electionType, p.area.code, p.stage)];
    insist(n && n.sourceRevision >= p.sourceRevision && n.sourceUpdatedAt >= p.sourceUpdatedAt, "Area results disappeared or regressed");
    if (n.sourceRevision === p.sourceRevision) insist(n.source.jsonSha256 === p.source.jsonSha256 && n.summarySource?.jsonSha256 === p.summarySource?.jsonSha256, "Area changed without new source revision");
  }
  return next;
}
