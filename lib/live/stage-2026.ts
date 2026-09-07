import { normalizeResult } from "./result-adapter";
import { insist, integer, list, object, string } from "./validation";

/** Separate 2026 intake. It never overwrites 2022 geography or links people by name alone. */
export function stageRiksdag2026(raw: unknown, options: Parameters<typeof normalizeResult>[1]) {
  insist(options.stage === "final-count", "Personal votes require the final-count source");
  const result = normalizeResult(raw, options);
  const sourceAreas = list(object(object(raw, "result").valomrade, "national area").valkretsLista, "constituencies");
  const personalVotes = sourceAreas.map(value => {
    const area = object(value, "constituency"), code = string(area.kod, "constituency code");
    const normalized = result.constituencies.find(c => c.code === code)!;
    const parties = list(object(object(area.rostfordelning, "votes").rosterPaverkaMandat, "valid votes").partiRoster, "parties").map(value => {
      const party = object(value, "party"), partyCode = string(party.partikod, "party code");
      const partyVotes = integer(party.antalRoster, "party votes");
      const sourceParty = normalized.parties.find(p => p.code === partyCode);
      insist(sourceParty?.votes === partyVotes, "Personal-vote party denominator differs from official count");
      const base = { partyCode, partyName: string(party.partibeteckning, "party name"), partyVotes };
      if (party.summeradePersonroster === null || party.summeradePersonroster === undefined) return { ...base, candidates: null };
      const candidates = list(party.summeradePersonroster, "summed personal votes").map(value => {
        const candidate = object(value, "candidate");
        return { sourceId: String(integer(candidate.kandidatnummer, "candidate number")), name: string(candidate.namn, "candidate name"), votes: integer(candidate.antalPersonroster, "personal votes") };
      });
      insist(new Set(candidates.map(c => c.sourceId)).size === candidates.length, "Duplicate personal-vote candidate in party and constituency");
      insist(candidates.reduce((sum, c) => sum + c.votes, 0) <= partyVotes, "Personal votes exceed the party denominator");
      if (party.listRoster !== null && party.listRoster !== undefined) {
        const totals = new Map<string, number>();
        const ballots = list(party.listRoster, "ballot lists").map(value => object(value, "ballot list"));
        insist(new Set(ballots.map(b => string(b.listnummer, "ballot identity"))).size === ballots.length, "Duplicate ballot list");
        for (const ballot of ballots) {
          const seen = new Set<string>(); let sum = 0;
          for (const value of list(ballot.personroster, "ballot personal votes")) {
            const c = object(value, "ballot candidate"), id = String(integer(c.kandidatNummer, "ballot candidate number")), votes = integer(c.antalPersonroster, "ballot personal votes");
            insist(!seen.has(id), "Duplicate candidate on a ballot list"); seen.add(id);
            totals.set(id, (totals.get(id) ?? 0) + votes); sum += votes;
          }
          insist(sum === integer(ballot.antalRosterMedPersonrost, "ballot personal-vote total") && sum <= integer(ballot.antalRoster, "ballot votes"), "Ballot personal votes do not reconcile");
        }
        insist(candidates.every(c => c.votes === (totals.get(c.sourceId) ?? 0)) && [...totals.keys()].every(id => candidates.some(c => c.sourceId === id)), "Ballot lists and summed personal votes disagree");
      }
      return { ...base, candidates };
    });
    return { electionType: "RD" as const, year: 2026 as const, level: "constituency" as const, areaCode: code, areaName: normalized.name, parties };
  });
  return { schemaVersion: 1 as const, methodVersion: "pv-2026-intake-1.0.0", classification: result.classification,
    publication: "staging-only" as const, historicalPromotion: "requires-reviewed-2026-geography-and-identity-links" as const,
    result, personalVotes };
}
