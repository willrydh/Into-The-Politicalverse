import type { ElectionComparison } from "./types";
import { checkRoundedPercent, insist, integer, list, object, percent, string, matchesPercent } from "./validation";

export const COMPARISON_VERSION = "pv-official-comparison-1.0.0";

/** Missing or non-comparable baselines stay missing, including for new parties. */
export function normalizeComparison(value: unknown, previousDate: unknown): ElectionComparison | null {
  const a = object(value, "comparison area");
  if (previousDate !== "2022-09-11" || a.statusJamforelse !== "Kan jämföras" || a.rostfordelning == null) return null;
  const distribution = object(a.rostfordelning, "comparison distribution");
  const valid = object(distribution.rosterPaverkaMandat, "previous valid votes");
  if (valid.antalRosterForegaendeVal == null || a.totaltAntalRosterForegaendeVal == null || a.antalRostberattigadeForegaendeVal == null) return null;
  const validVotes = integer(valid.antalRosterForegaendeVal, "previous valid votes");
  const totalVotes = integer(a.totaltAntalRosterForegaendeVal, "previous all votes");
  const eligibleVoters = integer(a.antalRostberattigadeForegaendeVal, "previous electorate");
  insist(validVotes <= totalVotes && totalVotes <= eligibleVoters, "Invalid previous vote totals");
  const invalid = object(distribution.rosterEjPaverkaMandat, "previous invalid votes");
  insist(validVotes + integer(invalid.antalRosterForegaendeVal, "previous invalid votes") === totalVotes, "Previous valid and invalid votes do not reconcile");
  const turnout = percent(totalVotes, eligibleVoters);
  checkRoundedPercent(a.valdeltagandeForegaendeVal, turnout, "previous turnout");
  const allocations = a.mandatfordelning == null ? [] : list(object(a.mandatfordelning, "mandates").partiLista, "mandate parties").map(p => object(p, "mandate party"));
  const parties = list(valid.partiRoster, "comparison parties").map(value => {
    const p = object(value, "previous party"), code = string(p.partikod, "previous party code");
    const votes = p.antalRosterForegaendeVal == null ? null : integer(p.antalRosterForegaendeVal, "previous party votes");
    const share = votes === null ? null : percent(votes, validVotes);
    if (votes !== null) checkRoundedPercent(p.andelRosterForegaendeVal, share, "previous party share");
    const allocation = allocations.find(s => s.partikod === code);
    return { code, votes, share, seats: allocation?.antalMandatForegaendeVal == null ? null : integer(allocation.antalMandatForegaendeVal, "previous seats") };
  });
  const other = valid.rosterOvrigaPartier == null ? null : object(valid.rosterOvrigaPartier, "previous other parties");
  const otherVotes = other?.antalRosterForegaendeVal == null ? null : integer(other.antalRosterForegaendeVal, "previous other votes");
  if (otherVotes !== null) checkRoundedPercent(other?.andelRosterForegaendeVal, percent(otherVotes, validVotes), "previous other share");
  const result: ElectionComparison = { year: 2022, validVotes, totalVotes, eligibleVoters, turnout, otherVotes, parties };
  validateComparison(result);
  return result;
}

export function validateComparison(value: unknown): void {
  if (value == null) return;
  const c = object(value, "previous election");
  insist(c.year === 2022, "Unexpected comparison year");
  const valid = integer(c.validVotes, "previous valid"), total = integer(c.totalVotes, "previous total"), eligible = integer(c.eligibleVoters, "previous electorate");
  insist(valid <= total && total <= eligible, "Invalid comparison totals");
  insist(matchesPercent(c.turnout, percent(total, eligible)), "Invalid comparison turnout");
  const parties = list(c.parties, "previous parties").map(p => object(p, "previous party"));
  insist(new Set(parties.map(p => p.code)).size === parties.length, "Duplicate previous party");
  for (const p of parties) {
    insist(/^\d{4}$/.test(String(p.code)), "Invalid previous party code");
    const votes = p.votes === null ? null : integer(p.votes, "previous party votes");
    insist(votes === null || votes <= valid, "Previous party exceeds total");
    insist(matchesPercent(p.share, votes === null ? null : percent(votes, valid)), "Invalid previous share");
    if (p.seats !== null) integer(p.seats, "previous seats");
  }
  if (c.otherVotes !== null) integer(c.otherVotes, "previous other votes");
  if (c.otherVotes !== null && parties.every(p => p.votes !== null)) insist(parties.reduce((s, p) => s + (p.votes as number), c.otherVotes as number) === valid, "Previous parties do not reconcile");
}
