import { integer, insist, list, object, string } from "../live/validation";
import { candidatePartyId } from "./source-parties";
import { validateBallotPositions } from "./ballots";
import type { CandidateArea, CandidateElection, ElectionIdentity, SourceCandidate } from "./types";

export const CANDIDATE_2026_METHOD = "candidate-2026-1.1.0";
export type CandidateCoverage = { expected: number; published: number; final: string[]; counted?: string[] };
export type CurrentCandidateCoverage = Record<CandidateElection, CandidateCoverage>;

/** Complete counted votes can be published before the authority allocates seats
 * and signs its protocol. This never promotes the result to established. */
export function personalCountComplete(value: unknown): boolean {
  const a = object(value, "personal-vote area");
  const total = integer(a.antalValdistriktSomSkaRaknas, "all districts");
  return total > 0 && integer(a.antalValdistriktRaknade, "counted districts") === total;
}

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
  // Multi-constituency councils publish ballot lists in their constituencies,
  // and only summed personal votes at council level. Reconcile both levels;
  // never discard that council or add its summary to its underlying votes.
  const parties = list(distribution.partiRoster, "parties").map(p => object(p, "party"));
  if (parties.some(p => p.listRoster === undefined) && area.valkretsLista !== undefined) {
    return aggregatePersonalCandidates(area, parties);
  }
  const partyVotes: Record<string, number> = {}, candidates: SourceCandidate[] = [];
  for (const p of parties) {
    const code = string(p.partikod, "party code"), votes = integer(p.antalRoster, "party votes");
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

function aggregatePersonalCandidates(area: Record<string, unknown>, parties: Record<string, unknown>[]): ReturnType<typeof personalCandidates> {
  const code = string(area.kod, "council code"), seenAreas = new Set<string>();
  const votes = new Map<string, number>(), totals = new Map<string, SourceCandidate>();
  const ballotLists = new Map<string, Set<string>>();
  const constituencies = list(area.valkretsLista, "council constituencies");
  insist(constituencies.length > 0, "Missing council constituencies");
  for (const value of constituencies) {
    const constituency = object(value, "council constituency"), childCode = string(constituency.kod, "constituency code");
    insist(childCode.startsWith(code) && childCode.length === code.length + 2 && !seenAreas.has(childCode), "Invalid or duplicate council constituency");
    seenAreas.add(childCode);
    const child = personalCandidates(constituency);
    for (const [party, count] of Object.entries(child.partyVotes)) votes.set(party, (votes.get(party) ?? 0) + count);
    // Count distinct printed lists, including candidates without a position.
    const distribution = object(object(constituency.rostfordelning, "distribution").rosterPaverkaMandat, "valid votes");
    for (const p of list(distribution.partiRoster, "parties").map(p => object(p, "party"))) {
      for (const b of list(p.listRoster, "constituency ballot lists").map(b => object(b, "ballot"))) {
        for (const c of list(b.personroster, "ballot candidates").map(c => object(c, "candidate"))) {
          const key = `${p.partikod}/${c.kandidatNummer}`, lists = ballotLists.get(key) ?? new Set<string>();
          lists.add(string(b.listnummer, "list number")); ballotLists.set(key, lists);
        }
      }
    }
    for (const c of child.candidates) {
      const key = `${c.partyCode}/${c.id}`, row = totals.get(key);
      if (!row) totals.set(key, structuredClone(c));
      else {
        insist(row.name === c.name, "Constituency candidate names disagree");
        row.votes += c.votes;
        for (const position of c.ballotPositions) if (!row.ballotPositions.some(b => b.listNumber === position.listNumber && b.position === position.position)) row.ballotPositions.push(position);
      }
    }
  }
  const partyVotes: Record<string, number> = {}, candidates: SourceCandidate[] = [], seen = new Set<string>();
  for (const p of parties) {
    const party = string(p.partikod, "party code"), count = integer(p.antalRoster, "party votes");
    insist(/^\d{4}$/.test(party) && !(party in partyVotes), "Duplicate or invalid personal-vote party");
    insist(p.listRoster === undefined, "Mixed council and constituency ballot lists");
    insist((votes.get(party) ?? 0) === count, "Council and constituency party votes disagree");
    partyVotes[party] = count;
    for (const value of p.summeradePersonroster == null ? [] : list(p.summeradePersonroster, "summed candidates")) {
      const c = object(value, "summed candidate"), key = `${party}/${integer(c.kandidatnummer, "candidate number")}`, row = totals.get(key);
      insist(row && !seen.has(key) && row.votes === integer(c.antalPersonroster, "summed personal votes"), "Council and constituency personal votes disagree");
      seen.add(key); row.name = string(c.namn, "candidate name"); row.partyVotes = count;
      row.lists = ballotLists.get(key)!.size;
      row.ballotPositions.sort((a, b) => a.listNumber.localeCompare(b.listNumber) || a.position - b.position);
      validateBallotPositions(row.ballotPositions, party); candidates.push(row);
    }
    insist(candidates.filter(c => c.partyCode === party).reduce((s, c) => s + c.votes, 0) <= count, "Personal votes exceed party votes");
  }
  insist(seen.size === totals.size && [...votes.keys()].every(p => p in partyVotes), "Council summary omits constituency results");
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
