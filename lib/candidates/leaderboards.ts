import { rankCandidates } from "./math";
import type { RankingMetric, RankingRow } from "./types";

export const LEADERBOARD_METHOD = "candidate-leaderboards-1.0.0";
export const RANKING_METRICS = ["votes", "support", "delta", "percent", "sharePoints"] as const;
export const DEFAULT_RANKING_METRIC: RankingMetric = "votes";
export type LeaderboardEntry = { row: RankingRow; rank: number; votes: number; members: RankingRow[] };

/** Filter geography/party first. Sum distinct RD observations only for total votes.
 * Keep the actual observations intact: a total is never a synthetic constituency. */
export function candidateLeaderboard(rows: RankingRow[], metric: RankingMetric, minimum = 1): LeaderboardEntry[] {
  if (metric !== "votes" || !rows.length || rows[0].electionType !== "RD") {
    return rankCandidates(rows, metric, minimum).map(({ row, rank }) => ({ row, rank, votes: row.votes, members: [row] }));
  }
  const groups = new Map<string, RankingRow[]>(), seen = new Set<string>();
  for (const row of rows) {
    if (row.electionType !== "RD" || row.year !== rows[0].year) throw new Error("Mixed Riksdag leaderboard scope");
    if (row.supersededBy) continue;
    const identity = `${row.person}:${row.partyCode}`, key = `${identity}:${row.areaCode}`;
    if (seen.has(key)) throw new Error("Duplicate Riksdag observation");
    seen.add(key);
    const group = groups.get(identity) ?? [];
    group.push(row); groups.set(identity, group);
  }
  const entries = [...groups.values()].map(members => {
    members.sort((a, b) => b.votes - a.votes || a.areaCode.localeCompare(b.areaCode));
    return { row: members[0], votes: members.reduce((sum, r) => sum + r.votes, 0), members, rank: 0 };
  }).sort((a, b) => b.votes - a.votes || a.row.name.localeCompare(b.row.name, "sv") || a.row.person.localeCompare(b.row.person) || a.row.partyCode.localeCompare(b.row.partyCode));
  let rank = 0;
  return entries.map((entry, i) => {
    if (i === 0 || entry.votes !== entries[i - 1].votes) rank = i + 1;
    return { ...entry, rank };
  });
}

export function rankingLabel(metric: RankingMetric, sv: boolean) {
  return {
    votes: sv ? "Flest personröster" : "Most personal votes",
    support: sv ? "Stöd längre ned" : "Support down the ballot",
    delta: sv ? "Flest nya röster" : "Most votes gained",
    percent: sv ? "Störst ökning, %" : "Biggest rise, %",
    sharePoints: sv ? "Störst andelslyft" : "Biggest share gain",
  }[metric];
}

/** Owner-selected display tiers. Exact positions remain available in the list. */
export function standingLabel(rank: number, sv: boolean) {
  if (!Number.isSafeInteger(rank) || rank < 1 || rank > 100) return null;
  return rank < 50 ? `#${rank}` : rank === 50 ? (sv ? "Topp 50" : "Top 50") : (sv ? "Topp 100" : "Top 100");
}
