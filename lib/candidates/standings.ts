import { CANDIDATE_YEARS, ELECTION_TYPES, type CandidateElection, type CandidateYear, type RankingMetric } from "./types";
import { LEADERBOARD_METHOD, RANKING_METRICS } from "./leaderboards";

export type StandingScope = "national" | "county" | "area";
// Compact tuples keep the profile download small; no leaderboard dataset enters it.
export type StandingRank = [metric: RankingMetric, scope: StandingScope, partyOnly: 0 | 1, rank: number, total: number];
export type StandingRecord = { year: CandidateYear; election: CandidateElection; area: string; party: string; ranks: StandingRank[] };
export type StandingsShard = { schemaVersion: 1; method: string; sourceVersion: string; classification: "DERIVED"; people: Record<string, StandingRecord[]> };

export function standingsHref(person: string, record: StandingRecord, standing: StandingRank, county: string) {
  const [metric, scope, partyOnly] = standing;
  return `/rankings/?${new URLSearchParams({ year: String(record.year), election: record.election, metric, minimum: "1", ...(scope === "area" ? { area: record.area } : scope === "county" ? { county } : {}), ...(partyOnly ? { party: record.party } : {}), candidate: person })}`;
}

export function validateStandings(v: unknown): asserts v is StandingsShard {
  const fail = () => { throw new Error("Invalid candidate standings"); };
  if (!v || typeof v !== "object") return fail();
  const d = v as StandingsShard;
  if (d.schemaVersion !== 1 || d.method !== LEADERBOARD_METHOD || d.classification !== "DERIVED" || typeof d.sourceVersion !== "string" || !/^[a-f0-9]{64}$/.test(d.sourceVersion) || !d.people || typeof d.people !== "object" || Array.isArray(d.people)) return fail();
  for (const [id, records] of Object.entries(d.people)) {
    if (!/^p\d{4}-\d+$/.test(id) || !Array.isArray(records)) return fail();
    const keys = new Set<string>();
    for (const r of records) {
      if (!r || !CANDIDATE_YEARS.includes(r.year) || !ELECTION_TYPES.includes(r.election) || !/^\d{2,4}$/.test(r.area) || !/^\d+$/.test(r.party) || !Array.isArray(r.ranks) || !r.ranks.length) return fail();
      const key = `${r.year}:${r.election}:${r.area}:${r.party}`;
      if (keys.has(key)) return fail(); keys.add(key);
      const scopes = new Set<string>();
      for (const s of r.ranks) {
        if (!Array.isArray(s) || s.length !== 5 || !RANKING_METRICS.includes(s[0]) || !["national", "county", "area"].includes(s[1]) || ![0, 1].includes(s[2]) || !Number.isSafeInteger(s[3]) || s[3] < 1 || s[3] > 100 || !Number.isSafeInteger(s[4]) || s[4] < s[3]) return fail();
        const scope = s.slice(0, 3).join(":");
        if (scopes.has(scope)) return fail(); scopes.add(scope);
      }
    }
  }
}
