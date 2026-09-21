import { integer, insist, list, object, string } from "../live/validation";
import { candidatePartyId } from "./source-parties";
import { validateBallotPositions } from "./ballots";
import type { CandidateArea, CandidateElection, ElectionIdentity, SourceCandidate } from "./types";

export const CANDIDATE_2026_METHOD = "candidate-2026-1.0.0";
export type CandidateCoverage = { expected: number; published: number; final: string[] };
export type CurrentCandidateCoverage = Record<CandidateElection, CandidateCoverage>;

export function parseCandidateCsv(raw: string): string[][] {
  const rows: string[][] = [], input = raw.replace(/^\uFEFF/, ""), row: string[] = [];
  let field = "", quoted = false, closed = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === '"' && field === "" && !closed) quoted = true;
    else if (c === ";" || c === "\n" || c === "\r") {
      row.push(field); field = ""; closed = false;
      if (c !== ";") { if (row.some(v => v !== "")) rows.push([...row]); row.length = 0; if (c === "\r" && input[i + 1] === "\n") i++; }
    } else { insist(!closed, "Unexpected text after quoted CSV field"); field += c; }
  }
  insist(!quoted, "Unterminated candidate CSV field");
  if (field || row.length) { row.push(field); rows.push([...row]); }
  return rows;
}

/** The mandate archive reports the same votes twice: by ballot and by person.
 * Reconcile them, never add the two representations. Blank party-only ballots
 * have no candidates and do not manufacture zero-vote candidacies. */
export function personalCandidates(value: unknown): { partyVotes: Record<string, number>; candidates: SourceCandidate[] } {
  const area = object(value, "personal-vote area");
  const distribution = object(object(area.rostfordelning, "distribution").rosterPaverkaMandat, "valid votes");
  const partyVotes: Record<string, number> = {}, candidates: SourceCandidate[] = [];
  for (const v of list(distribution.partiRoster, "parties")) {
    const p = object(v, "party"), code = string(p.partikod, "party code"), votes = integer(p.antalRoster, "party votes");
    insist(/^\d{4}$/.test(code) && !(code in partyVotes), "Duplicate or invalid personal-vote party");
    partyVotes[code] = votes;
    const totals = new Map<string, SourceCandidate>(), seenLists = new Set<string>();
    for (const b of list(p.listRoster, "final ballot lists")) {
      const ballot = object(b, "ballot"), number = string(ballot.listnummer, "list number");
      insist(new RegExp(`^${code}-\\d{5}$`).test(number) && !seenLists.has(number), "Invalid or duplicate ballot identity");
      seenLists.add(number);
      let personal = 0;
      const seenCandidates = new Set<string>();
      for (const v of list(ballot.personroster, "ballot candidates")) {
        const c = object(v, "candidate"), id = String(integer(c.kandidatNummer, "candidate number"));
        insist(!seenCandidates.has(id), "Duplicate candidate on ballot"); seenCandidates.add(id);
        const count = integer(c.antalPersonroster, "personal votes"), name = string(c.namn, "candidate name");
        const position = integer(c.kandidatNummerPaListan, "printed position");
        const row = totals.get(id) ?? { id, name, partyCode: code, partyId: candidatePartyId(code), partyName: string(p.partibeteckning, "party name"), votes: 0, partyVotes: votes, lists: 0, ballotPositions: [] };
        row.votes += count; row.lists++;
        // A zero position denotes no printed position, not first place.
        if (position > 0) row.ballotPositions.push({ listNumber: number, position });
        totals.set(id, row); personal += count;
      }
      insist(personal === integer(ballot.antalRosterMedPersonrost, "ballot personal total") && personal <= integer(ballot.antalRoster, "ballot total"), "Ballot personal total mismatch");
    }
    const summed = p.summeradePersonroster == null ? [] : list(p.summeradePersonroster, "summed candidates");
    insist(summed.length === totals.size, "Missing summed personal votes");
    const seen = new Set<string>();
    for (const v of summed) {
      const c = object(v, "summed candidate"), id = String(integer(c.kandidatnummer, "candidate number")), row = totals.get(id);
      insist(row && !seen.has(id) && row.votes === integer(c.antalPersonroster, "summed personal votes"), "Summed and ballot personal votes disagree");
      seen.add(id); row.name = string(c.namn, "candidate name");
      row.ballotPositions.sort((a, b) => a.listNumber.localeCompare(b.listNumber) || a.position - b.position);
      validateBallotPositions(row.ballotPositions, code);
      candidates.push(row);
    }
    insist([...totals.values()].reduce((s, c) => s + c.votes, 0) <= votes, "Personal votes exceed party votes");
  }
  return { partyVotes, candidates };
}

export function candidateArea2026(value: unknown, scope: Pick<CandidateArea, "electionType" | "code" | "name" | "level" | "county" | "parent" | "members">): CandidateArea {
  return { ...scope, supersededBy: null, ...personalCandidates(value) };
}

/** Identity evidence only. The CSV never supplies vote counts. */
export function candidateIdentities2026(rows: string[][], municipalityNames: Map<string, string>): Record<string, ElectionIdentity> {
  const [header, ...body] = rows;
  insist(header?.[15] === "KANDIDATNUMMER" && header[17] === "ÅLDER_PÅ_VALDAGEN" && header[19] === "FOLKBOKFÖRINGSKOMMUN" && header[22] === "GILTIG", "Candidate register schema changed");
  const identities: Record<string, ElectionIdentity> = {};
  for (const row of body) {
    insist(row.length === header.length, "Candidate register column count changed");
    if (row[22] !== "J" || !/^\d+$/.test(row[15])) continue;
    const entry = identities[row[15]] ??= { names: [], ages: [], municipalities: [] };
    const name = row[16].trim(), age = /^\d+$/.test(row[17]) ? Number(row[17]) : null;
    if (name && !entry.names.includes(name)) entry.names.push(name);
    if (age !== null && !entry.ages.includes(age)) entry.ages.push(age);
    const residence = municipalityNames.get(row[19].trim()), candidature = row[0] === "KF" ? row[1].padStart(4, "0") : null;
    for (const municipality of [residence, candidature]) if (municipality && !entry.municipalities.includes(municipality)) entry.municipalities.push(municipality);
  }
  for (const entry of Object.values(identities)) { entry.names.sort(); entry.ages.sort((a, b) => a - b); entry.municipalities.sort(); }
  return identities;
}
