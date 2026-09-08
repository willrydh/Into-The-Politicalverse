import { RANKING_METRICS, rankingLabel, standingLabel } from "./leaderboards";
import { selectStandingCandidacy, type StandingRecord, type StandingScope } from "./standings";
import type { ShareLocale, ShareScope } from "./sharing";

export type ShareStandingContext = {
  sourceVersion: string; year: number; partyCode: string; party: string; partyOnly: 0 | 1;
  query: Record<string, string>;
};

export function shareStandingContext(scope: ShareScope, params: URLSearchParams, sourceVersion: string): ShareStandingContext {
  const { year, selected, candidacies, partyOnly } = selectStandingCandidacy(scope.candidacies, params, scope.year);
  return { sourceVersion, year, partyCode: selected.partyCode, party: selected.party, partyOnly, query: {
    ...(year !== scope.year ? { year: String(year) } : {}),
    ...(selected !== candidacies[0] ? { standingParty: selected.partyCode } : {}),
    ...(partyOnly ? { peers: "party" } : {}),
  } };
}

const partyPeople: Record<string, [string, string]> = {
  M: ["moderater", "Moderates"], S: ["socialdemokrater", "Social Democrats"], SD: ["sverigedemokrater", "Sweden Democrats"],
  V: ["vänsterpartister", "Left Party candidates"], MP: ["miljöpartister", "Greens"], C: ["centerpartister", "Centre Party candidates"],
  KD: ["kristdemokrater", "Christian Democrats"], L: ["liberaler", "Liberals"], FP: ["folkpartister", "Liberal Party candidates"],
};
const short = (text: string, max: number) => text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
const shortArea = (name: string) => short(name.replace("Västra Götalands läns ", "VG ").replace("Västra Götalands län", "Västra Götaland").replace("Skåne läns ", "Skåne "), 42);

// One person can carry the same national/county rank in many RD records.
// Deduplicate those cohorts before choosing five, so repeated ballot areas do
// not crowd out distinct achievements. Never treat a list position as a rank.
export function shareStandingHighlights(person: import("./sharing").SharePerson, scope: ShareScope, context: ShareStandingContext, records: StandingRecord[], counties: { code: string; name: string }[], locale: ShareLocale) {
  const sv = locale === "sv", preferredCounty = scope.candidacies.find(c => c.year === context.year)?.county;
  const unique = new Map<string, { metric: typeof RANKING_METRICS[number]; rank: number; total: number; partyOnly: 0 | 1; scope: StandingScope; preferred: boolean; election: string; label: string; detail: string; key: string }>();
  for (const record of records) {
    if (record.year !== context.year) continue;
    const result = person.scopes.find(s => s.election === record.election && s.area === record.area);
    const candidacy = result?.candidacies.find(c => c.year === record.year && c.partyCode === record.party);
    if (!result || !candidacy) continue;
    for (const [metric, geography, partyOnly, rank, total] of record.ranks) {
      if (geography === "county" && record.election === "RF") continue;
      const code = geography === "national" ? "SE" : geography === "county" ? candidacy.county : record.area;
      const aggregated = record.election === "RD" && metric === "votes";
      const key = `${record.year}:${record.election}:${record.party}:${metric}:${geography}:${code}:${partyOnly}${aggregated ? "" : ":" + record.area}`;
      const existing = unique.get(key);
      if (existing) {
        if (existing.rank !== rank || existing.total !== total) throw new Error(`Conflicting standing for ${person.id} in ${key}: ${existing.rank}/${existing.total} and ${rank}/${total}`);
        continue;
      }
      const location = geography === "national" ? (sv ? "Sverige" : "Sweden") : geography === "county" ? counties.find(c => c.code === code)?.name : result.areaName;
      if (!location) throw new Error("Missing standing geography");
      const election = ({ RD: sv ? "Riksdag" : "Riksdag", KF: sv ? "Kommunval" : "Municipal election", RF: sv ? "Regionval" : "Regional election" })[record.election];
      const partyName = partyPeople[candidacy.party]?.[sv ? 0 : 1] ?? short(candidacy.party, 30);
      const capitalParty = partyName.charAt(0).toUpperCase() + partyName.slice(1);
      const multipleAreas = person.scopes.some(s => s !== result && s.election === record.election && s.candidacies.some(c => c.year === record.year && c.partyCode === record.party));
      const areaDetail = !aggregated && geography !== "area" && (record.election === "RD" || multipleAreas) ? ` · ${shortArea(result.areaName)}` : "";
      const peerLocation = geography === "national" && partyOnly && partyPeople[candidacy.party]
        ? `${sv ? `Svenska ${partyName}` : `${partyName} · Sweden`}${areaDetail}`
        : `${shortArea(location)}${areaDetail} · ${partyOnly ? capitalParty : sv ? "Alla partier" : "All parties"}`;
      const preferred = record.election === scope.election && ((geography === "national" && metric === "votes") || (geography === "county" && metric === "votes" ? candidacy.county === preferredCounty : record.area === scope.area));
      unique.set(key, { metric, rank, total, partyOnly, scope: geography, preferred, election: record.election, label: rankingLabel(metric, sv),
        detail: `${election} · ${peerLocation}`, key });
    }
  }
  const ordered = [...unique.values()].sort((a, b) =>
    Number(b.scope === "national") - Number(a.scope === "national") ||
    Number(b.preferred) - Number(a.preferred) || a.partyOnly - b.partyOnly ||
    a.rank - b.rank || b.total - a.total || RANKING_METRICS.indexOf(a.metric) - RANKING_METRICS.indexOf(b.metric) || a.key.localeCompare(b.key));
  return { year: context.year, total: ordered.length, items: ordered.slice(0, 5).map(r => ({ ...r, placement: standingLabel(r.rank, sv)! })) };
}
export type ShareStandingHighlights = ReturnType<typeof shareStandingHighlights>;
