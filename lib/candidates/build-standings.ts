// Build-time only. Both public views use the same ranking rules before top-100 clipping.
import { candidateLeaderboard, RANKING_METRICS } from "./leaderboards";
import type { Person, RankingRow, RankingsPayload } from "./types";
import type { StandingRecord, StandingScope } from "./standings";

function groupRows(rows: RankingRow[], key: (row: RankingRow) => string) {
  const groups = new Map<string, RankingRow[]>();
  for (const row of rows) { const id = key(row), group = groups.get(id) ?? []; group.push(row); groups.set(id, group); }
  return groups.values();
}

export function buildStandings(people: Person[], payloads: Iterable<RankingsPayload>) {
  const records = new Map<string, Map<string, StandingRecord>>();
  for (const p of people) records.set(p.id, new Map());
  function addGroup(rows: RankingRow[], scope: StandingScope, partyOnly: 0 | 1) {
    for (const metric of RANKING_METRICS) {
      const ranked = candidateLeaderboard(rows, metric, 1);
      for (const entry of ranked) {
        if (entry.rank > 100) break;
        for (const r of entry.members) {
          const person = records.get(r.person)!;
          const key = `${r.year}:${r.electionType}:${r.areaCode}:${r.partyCode}`;
          const record = person.get(key) ?? { year: r.year, election: r.electionType, area: r.areaCode, party: r.partyCode, ranks: [] };
          record.ranks.push([metric, scope, partyOnly, entry.rank, ranked.length]);
          person.set(key, record);
        }
      }
    }
  }
  function addScope(rows: RankingRow[], scope: StandingScope) {
    addGroup(rows, scope, 0);
    for (const group of groupRows(rows, r => r.partyCode)) addGroup(group, scope, 1);
  }
  for (const payload of payloads) {
    addScope(payload.rows, "national");
    if (payload.electionType !== "RF") for (const group of groupRows(payload.rows, r => r.county)) addScope(group, "county");
    for (const group of groupRows(payload.rows, r => r.areaCode)) addScope(group, "area");
  }
  return new Map([...records].map(([id, person]) => [id, [...person.values()]]));
}
