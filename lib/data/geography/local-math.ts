import { PARTY_IDS, type PartyId } from "../elections/types";
import type { LocalArea, LocalObservation, LocalYear } from "./local-types";

export function roundLocal(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
export function voteShare(result: LocalObservation | undefined, party: PartyId): number | null {
  return result && result.validVotes > 0 ? result.votes[party] / result.validVotes * 100 : null;
}
export function localTurnout(result: LocalObservation | undefined): number | null {
  return result && result.eligibleVoters > 0 ? result.totalVotes / result.eligibleVoters * 100 : null;
}
export function localSwing(area: LocalArea, party: PartyId): number | null {
  if (area.level === "district" && area.comparison?.status !== "comparable") return null;
  const current = voteShare(area.results.find(r => r.year === 2022), party);
  const previous = voteShare(area.results.find(r => r.year === 2018), party);
  return current === null || previous === null ? null : current - previous;
}
export function sumObservations(results: LocalObservation[], year: LocalYear): LocalObservation {
  if (!results.length || results.some(r => r.year !== year)) throw new Error(`Missing or mixed-year local observations: ${year}`);
  const sum: LocalObservation = { year, validVotes: 0, totalVotes: 0, eligibleVoters: 0, votes: Object.fromEntries(PARTY_IDS.map(p => [p, 0])) as Record<PartyId, number> };
  for (const result of results) {
    validateObservation(result);
    sum.validVotes += result.validVotes; sum.totalVotes += result.totalVotes; sum.eligibleVoters += result.eligibleVoters;
    for (const party of PARTY_IDS) sum.votes[party] += result.votes[party];
  }
  validateObservation(sum);
  return sum;
}
export function validateObservation(result: LocalObservation): void {
  const counts = [result.validVotes, result.totalVotes, result.eligibleVoters, ...PARTY_IDS.map(p => result.votes[p])];
  if (counts.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error("Invalid local vote count");
  if (PARTY_IDS.reduce((sum, p) => sum + result.votes[p], 0) !== result.validVotes || result.totalVotes < result.validVotes) throw new Error("Local vote totals do not reconcile");
  // Collection districts have votes but no separate electorate. Their votes
  // belong in municipality/county totals, never in a fabricated local turnout.
  if (result.eligibleVoters > 0 && result.totalVotes > result.eligibleVoters) throw new Error("Local turnout exceeds the electorate");
}
