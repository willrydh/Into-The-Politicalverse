import { compareCandidate } from "./math";
import { selectCandidateProfile } from "./profile-selection";
import { type SharePerson, type ShareScope } from "./sharing";
import type { CandidateResult, Person } from "./types";

const party = (r: CandidateResult) => r.partyId === "OTHER" ? r.partyName : r.partyId === "L" && r.year <= 2014 ? "FP" : r.partyId;

export function candidateSharingData(person: Person): Omit<SharePerson, "revision"> {
  const defaults = selectCandidateProfile(person, new URLSearchParams());
  const scopes: ShareScope[] = [];
  for (const election of defaults.available) {
    const { areas } = selectCandidateProfile(person, new URLSearchParams({ election }));
    for (const { code: area } of areas) {
      const { results, latest } = selectCandidateProfile(person, new URLSearchParams({ election, area }));
      const comparison = compareCandidate(latest, person.results);
      const firstYear = Math.min(...results.map(r => r.year));
      const history: ShareScope["history"] = [];
      for (let year = firstYear; year <= latest.year; year += 4) {
        const observations = results.filter(r => r.year === year);
        const observation = observations.length === 1 ? observations[0] : null;
        history.push({ year, votes: observation?.votes ?? null, party: observation ? party(observation) : "", connect: !!observation && compareCandidate(observation, person.results).delta !== null });
      }
      scopes.push({ election, area, areaName: latest.areaName, year: latest.year, party: party(latest), votes: latest.votes, percent: comparison.percent,
        previousParty: comparison.previous ? (comparison.previous.partyId === "OTHER" ? comparison.previous.partyName : comparison.previous.partyId === "L" && comparison.previous.year <= 2014 ? "FP" : comparison.previous.partyId) : null,
        reason: comparison.reason, status: "final", candidacies: results.map(r => ({ year: r.year, partyCode: r.partyCode, party: party(r), county: r.county })), history });
    }
  }
  return { id: person.id, name: person.name, defaultElection: defaults.election, scopes };
}
