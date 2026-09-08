import type { CandidateComparison, CandidateResult, Person, RankingMetric, RankingRow } from "./types";
export const DOWN_BALLOT_MIN_POSITION = 4;
export const DOWN_BALLOT_MIN_VOTES = 100;
export const personalVoteShare = (r: { votes: number; partyVotes: number }) => r.partyVotes > 0 ? r.votes / r.partyVotes * 100 : null;
export function voteChange(current: number, previous: number | null) {
  if (previous === null) return { delta: null, percent: null };
  if (![current, previous].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error("Invalid vote comparison");
  return { delta: current - previous, percent: previous > 0 ? (current - previous) / previous * 100 : null };
}
export function compareCandidate(current: CandidateResult, results: Person["results"]): CandidateComparison {
  const base: CandidateComparison = { reason: "no-baseline", previous: null, delta: null, percent: null, sharePoints: null };
  const sameScope = results.filter(r => r.electionType === current.electionType && r.level === current.level && r.areaCode === current.areaCode);
  const previous = sameScope.filter(r => r.year === current.year - 4);
  if (previous.length > 1 || sameScope.filter(r => r.year === current.year).length > 1) return { ...base, reason: "multiple-parties" };
  if (!previous.length) return base;
  const p = previous[0];
  const context = { ...base, previous: { year: p.year, partyCode: p.partyCode, partyId: p.partyId, partyName: p.partyName, votes: p.votes, partyVotes: p.partyVotes, ballotPositions: p.ballotPositions } };
  if (current.supersededBy || p.supersededBy) return { ...context, reason: "replaced-election" };
  // Constituency codes alone do not prove that the same voters are covered.
  if (!current.boundaryKey || current.boundaryKey !== p.boundaryKey) return { ...context, reason: "changed-area" };
  const share = personalVoteShare(current), oldShare = personalVoteShare(p);
  return { ...context, reason: p.votes === 0 ? "zero-baseline" : "comparable", ...voteChange(current.votes, p.votes), sharePoints: share === null || oldShare === null ? null : share - oldShare };
}
export function rankingValue(row: RankingRow, metric: RankingMetric): number | null {
  if (metric === "votes") return row.supersededBy ? null : row.votes;
  if (metric === "support") return !row.supersededBy && row.votes >= DOWN_BALLOT_MIN_VOTES && row.ballotPositions.length > 0 && row.ballotPositions.every(b => b.position >= DOWN_BALLOT_MIN_POSITION) ? personalVoteShare(row) : null;
  return row.comparison[metric];
}
export function rankCandidates(rows: RankingRow[], metric: RankingMetric, minimum = 1) {
  const eligible = rows.filter(row => {
    const value = rankingValue(row, metric);
    return value !== null && (metric === "votes" || metric === "support" || ((row.comparison.previous?.votes ?? -1) >= minimum && value > 0));
  }).sort((a, b) => rankingValue(b, metric)! - rankingValue(a, metric)! || a.name.localeCompare(b.name, "sv") || a.areaCode.localeCompare(b.areaCode) || a.person.localeCompare(b.person));
  let rank = 0;
  return eligible.map((row, i) => {
    if (i === 0 || Math.abs(rankingValue(row, metric)! - rankingValue(eligible[i - 1], metric)!) > 1e-9) rank = i + 1;
    return { row, rank };
  });
}
