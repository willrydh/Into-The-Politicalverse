import { calculateRiksdagSeats } from "../simulator/riksdag-rules";
import { SIMULATOR_PARTY_IDS, type SimulatorPartyVotes } from "../simulator/types";
import { PARTY_CODE_TO_ID } from "./constants";
import seats from "../../data/normalized/riksdag-seat-model-inputs.json";
import type { CountingStage, FeedMode, LiveArea, LiveParty, LiveResult } from "./types";
import { checkRoundedPercent, insist, integer, list, object, percent, sourceTimestamp, string } from "./validation";

const fixedSeats = seats.scenario.fixedSeatsByConstituency as Record<string, number>;

function normalizeArea(raw: unknown, national: boolean): LiveArea {
  const a = object(raw, "area");
  const distribution = object(a.rostfordelning, "vote distribution");
  const valid = object(distribution.rosterPaverkaMandat, "valid votes");
  const invalid = object(distribution.rosterEjPaverkaMandat, "invalid votes");
  const validVotes = integer(valid.antalRoster, "valid votes");
  const invalidVotes = integer(invalid.antalRoster, "invalid votes");
  const totalVotes = integer(a.totaltAntalRoster, "total votes");
  insist(validVotes + invalidVotes === totalVotes, "Valid plus invalid votes must equal all ballots");
  const parties: LiveParty[] = list(valid.partiRoster, "party votes").map(rawParty => {
    const p = object(rawParty, "party");
    const votes = integer(p.antalRoster, "party votes");
    const code = string(p.partikod, "party code");
    insist(/^\d{4}$/.test(code), "Party code must retain its four digits");
    const share = percent(votes, validVotes);
    checkRoundedPercent(p.andelRoster, share, "party share");
    return { code, name: string(p.partibeteckning, "party name"), abbreviation: typeof p.partiforkortning === "string" ? p.partiforkortning.trim() : "", votes, share, seats: null, fixedSeats: null, adjustmentSeats: null };
  });
  insist(new Set(parties.map(p => p.code)).size === parties.length, "Duplicate party code");
  const other = valid.rosterOvrigaPartier == null ? null : object(valid.rosterOvrigaPartier, "other parties");
  const otherVotes = other ? integer(other.antalRoster, "other votes") : 0;
  if (other) checkRoundedPercent(other.andelRoster, percent(otherVotes, validVotes), "other share");
  insist(parties.reduce((sum, p) => sum + p.votes, otherVotes) === validVotes, "Party votes and other votes must reconcile");
  const countedDistricts = integer(a.antalValdistriktRaknade, "counted districts");
  const totalDistricts = integer(a.antalValdistriktSomSkaRaknas, "all districts");
  insist(countedDistricts <= totalDistricts, "Counted districts exceed total districts");
  const eligibleVoters = integer(a.antalRostberattigade, "eligible voters");
  const eligibleInCountedDistricts = integer(a.antalRostberattigadeIRaknadeValdistrikt, "eligible in counted districts");
  insist(eligibleInCountedDistricts <= eligibleVoters && totalVotes <= eligibleInCountedDistricts, "Invalid eligible-voter denominator");
  const turnoutInCountedDistricts = percent(totalVotes, eligibleInCountedDistricts);
  checkRoundedPercent(a.valdeltagande, turnoutInCountedDistricts, "turnout");
  if (a.mandatfordelning != null) {
    const allocations = list(object(a.mandatfordelning, "seat distribution").partiLista, "party seats");
    const seen = new Set<string>();
    let allocated = 0;
    for (const item of allocations) {
      const p = object(item, "party seats");
      const code = string(p.partikod, "seat party code");
      insist(!seen.has(code), "Duplicate seat party code"); seen.add(code);
      const total = integer(p.antalMandat, "seats");
      insist(total === integer(p.antalFastaMandat, "fixed seats") + integer(p.antalUtjamningsmandat, "adjustment seats"), "Seat components mismatch");
      const party = parties.find(party => party.code === code);
      insist(party || total === 0, "Seat allocation references a missing party");
      if (party) { party.seats = total; party.fixedSeats = p.antalFastaMandat as number; party.adjustmentSeats = p.antalUtjamningsmandat as number; }
      allocated += total;
    }
    if (national) insist(allocated === 0 || allocated === 349, "Published Riksdag seats must total 349");
    if (allocated === 0) parties.forEach(p => { p.seats = null; p.fixedSeats = null; p.adjustmentSeats = null; });
    else {
      parties.forEach(p => { p.seats ??= 0; p.fixedSeats ??= 0; p.adjustmentSeats ??= 0; });
      if (national) insist(parties.reduce((s, p) => s + (p.fixedSeats ?? 0), 0) === 310 && parties.reduce((s, p) => s + (p.adjustmentSeats ?? 0), 0) === 39, "National seat components must sum to 310 and 39");
    }
  }
  return { code: string(a.kod, "area code"), name: string(national ? a.namn : a.namnValkrets, "area name"), countedDistricts, totalDistricts, validVotes, invalidVotes, totalVotes, eligibleVoters, eligibleInCountedDistricts, turnoutInCountedDistricts, parties, otherVotes, fixedSeats: integer(a.totaltAntalFastaMandat, "fixed seat structure") };
}

function verifySeatEngine(national: LiveArea, constituencies: LiveArea[]): LiveResult["seatCheck"] {
  const skip = (reason: string): LiveResult["seatCheck"] => ({ status: "not-applicable", reason, tieCount: 0 });
  if (national.parties.every(p => p.seats === null) || constituencies.some(c => c.validVotes === 0)) return skip("Official mandate calculation or constituency vote coverage is not yet available.");
  const unknown = national.parties.filter(p => !PARTY_CODE_TO_ID[p.code]);
  if (unknown.some(p => p.votes * 100 >= national.validVotes * 4 || constituencies.some(c => (c.parties.find(x => x.code === p.code)?.votes ?? 0) * 100 >= c.validVotes * 12))) return skip("An additional party reaches an electoral threshold; the eight-party scenario engine is not applicable.");
  const result = calculateRiksdagSeats({ nationalValidVotes: national.validVotes, constituencies: constituencies.map(c => ({ code: c.code, name: c.name, validVotes: c.validVotes, fixedSeats: c.fixedSeats, partyVotes: Object.fromEntries(SIMULATOR_PARTY_IDS.map(id => [id, c.parties.find(p => PARTY_CODE_TO_ID[p.code] === id)?.votes ?? 0])) as SimulatorPartyVotes })) });
  const matches = result.parties.every(p => {
    const official = national.parties.find(x => PARTY_CODE_TO_ID[x.code] === p.partyId);
    return (official?.seats ?? 0) === p.totalSeats && (official?.fixedSeats ?? 0) === p.fixedSeats && (official?.adjustmentSeats ?? 0) === p.adjustmentSeats;
  });
  insist(matches || result.tieBreaks.length > 0, "Independent mandate engine disagrees with official allocation; quarantine for review");
  return { status: result.tieBreaks.length ? "official-lot" : "matched", reason: matches ? "Independent engine reproduces every party's fixed, adjustment and total seats. Official allocations remain authoritative, including drawings of lots." : "Equal quotients require the authority's drawing of lots; only official mandates are displayed.", tieCount: result.tieBreaks.length };
}

export function normalizeResult(raw: unknown, options: { mode: FeedMode; stage: CountingStage; now: string; source: LiveResult["source"] }): LiveResult {
  const d = object(raw, "result");
  insist(d.valtyp === "RD" && d.valdatum === "2026-09-13" && d.valklass === "ordinarie val", "Wrong election identity");
  insist(d.rakningstillfalle === (options.stage === "preliminary" ? "preliminär" : "slutlig"), "Wrong counting stage");
  if (options.mode === "production") insist((d.test === undefined || d.test === false) && /^Val_(2026|20260913)$/.test(string(d.valtillfalle, "election name")), "Test or rehearsal data is forbidden in production");
  else insist(d.test === true && d.valtillfalle === "Genrep_2026", "Rehearsal requires explicit official test data");
  const sourceUpdatedAt = sourceTimestamp(d.senasteUppdateringstid);
  insist(Date.parse(sourceUpdatedAt) <= Date.parse(options.now) + 60_000, "Future source timestamp");
  const a = object(d.valomrade, "national area");
  insist(a.kod === "00" && a.totaltAntalMandat === 349 && a.totaltAntalFastaMandat === 310 && a.totaltAntalUtjamningsMandat === 39 && a.valomradessparrProcent === 4 && a.valkretssparrProcent === 12, "Swedish election rules or national identity changed");
  const national = normalizeArea(a, true);
  const constituencies = list(a.valkretsLista, "constituencies").map(c => normalizeArea(c, false));
  insist(constituencies.length === 29 && new Set(constituencies.map(c => c.code)).size === 29, "Expected 29 unique constituencies");
  for (const c of constituencies) insist(fixedSeats[c.code] === c.fixedSeats, `2026 fixed-seat structure mismatch in ${c.code}`);
  for (const key of ["validVotes", "invalidVotes", "totalVotes", "eligibleVoters", "eligibleInCountedDistricts", "countedDistricts", "totalDistricts", "otherVotes"] as const) {
    insist(constituencies.reduce((sum, c) => sum + c[key], 0) === national[key], `Constituencies do not reconcile to national ${key}`);
  }
  for (const party of national.parties) insist(constituencies.reduce((sum, c) => sum + (c.parties.find(p => p.code === party.code)?.votes ?? 0), 0) === party.votes, `National party votes do not reconcile for ${party.code}`);
  if (constituencies.every(c => c.parties.some(p => p.seats !== null))) {
    for (const party of national.parties) for (const key of ["seats", "fixedSeats", "adjustmentSeats"] as const) {
      insist(constituencies.reduce((sum, c) => sum + (c.parties.find(p => p.code === party.code)?.[key] ?? 0), 0) === party[key], `Constituency ${key} do not reconcile for ${party.code}`);
    }
  }
  for (const c of constituencies) insist(c.parties.every(p => national.parties.some(n => n.code === p.code)), "Constituency party absent from national result");
  let protocolUrl: string | null = null;
  if (a.lankTillProtokoll) {
    protocolUrl = string(a.lankTillProtokoll, "protocol URL");
    insist(protocolUrl.startsWith("https://resultat.val.se/protokoll/") && protocolUrl.endsWith(".pdf"), "Unexpected result protocol origin");
  }
  return { electionDate: "2026-09-13", classification: options.mode === "production" ? "OFFICIAL" : "TEST", stage: options.stage, sourceUpdatedAt, sourceRevision: integer(d.antalUppdateringar, "revision"), national, constituencies, protocolUrl, seatCheck: verifySeatEngine(national, constituencies), source: options.source };
}

export function assertResultAdvance(previous: LiveResult | null, next: LiveResult): void {
  if (!previous) return;
  insist(previous.stage === next.stage && previous.classification === next.classification, "Cannot mix counting phases or rehearsal data");
  insist(next.sourceRevision >= previous.sourceRevision && next.sourceUpdatedAt >= previous.sourceUpdatedAt, "Source version regressed");
  if (next.sourceRevision === previous.sourceRevision) insist(next.source.jsonSha256 === previous.source.jsonSha256, "Same source revision changed contents");
  // Vote and counted-district totals may legitimately decrease after official corrections.
}
