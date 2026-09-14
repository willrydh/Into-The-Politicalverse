import type { AreaResult, CountedArea, ElectionType } from "./area-types";
import type { CountingStage, LiveParty, LiveResult } from "./types";
import { normalizeComparison } from "./comparison";
import { checkRoundedPercent, insist, integer, list, object, percent, sourceTimestamp, string } from "./validation";

/** Reviewed signed files cap 1.95–<2 at 1.9 and 2.95–<3 at 2.9
 * when deltaMandatfordelning is nej. Keep the exact vote-derived share, never
 * infer eligibility from that display rounding or broaden other tolerances. */
export function checkAreaPartyShare(value: unknown, actual: number | null, threshold: unknown, participates: unknown): void {
  if (actual !== null && typeof threshold === "number" && [2, 3, 4].includes(threshold) && participates === "nej" && value === threshold - 0.1 && actual >= threshold - 0.05 && actual < threshold) return;
  checkRoundedPercent(value, actual, "party share");
}

export function normalizeCountedArea(value: unknown, previousDate: unknown, municipality = false): CountedArea {
  const a = object(value, "election area");
  const code = string(municipality ? a.kommunkod : a.kod, "area code"), name = string(a.namn, "area name");
  const countedDistricts = integer(a.antalValdistriktRaknade, "counted districts"), totalDistricts = integer(a.antalValdistriktSomSkaRaknas, "all districts");
  const totalVotes = integer(a.totaltAntalRoster, "all ballots"), eligibleVoters = integer(a.antalRostberattigade, "electorate"), eligibleInCountedDistricts = integer(a.antalRostberattigadeIRaknadeValdistrikt, "counted electorate");
  insist(countedDistricts <= totalDistricts && totalVotes <= eligibleInCountedDistricts && eligibleInCountedDistricts <= eligibleVoters, "Invalid coverage or electorate");
  const turnoutInCountedDistricts = percent(totalVotes, eligibleInCountedDistricts);
  checkRoundedPercent(a.valdeltagande, turnoutInCountedDistricts, "turnout");
  let validVotes = 0, invalidVotes = 0, otherVotes = 0;
  const parties: LiveParty[] = [];
  if (a.rostfordelning === null) insist(totalVotes === 0 && countedDistricts === 0 && eligibleInCountedDistricts === 0 && a.mandatfordelning == null, "Missing reported distribution");
  else {
    const distribution = object(a.rostfordelning, "distribution"), valid = object(distribution.rosterPaverkaMandat, "valid ballots");
    validVotes = integer(valid.antalRoster, "valid ballots");
    invalidVotes = integer(object(distribution.rosterEjPaverkaMandat, "invalid ballots").antalRoster, "invalid ballots");
    if (valid.rosterOvrigaPartier != null) {
      const other = object(valid.rosterOvrigaPartier, "other parties");
      otherVotes = integer(other.antalRoster, "other votes");
      checkRoundedPercent(other.andelRoster, percent(otherVotes, validVotes), "other share");
    }
    for (const item of list(valid.partiRoster, "party votes")) {
      const p = object(item, "party"), votes = integer(p.antalRoster, "party votes"), partyCode = string(p.partikod, "party code");
      insist(/^\d{4}$/.test(partyCode), "Invalid party identity");
      checkAreaPartyShare(p.andelRoster, percent(votes, validVotes), a.valomradessparrProcent, p.deltaMandatfordelning);
      parties.push({ code: partyCode, name: string(p.partibeteckning, "party name"), abbreviation: typeof p.partiforkortning === "string" ? p.partiforkortning : "", votes, share: percent(votes, validVotes), seats: null, fixedSeats: null, adjustmentSeats: null });
    }
    insist(new Set(parties.map(p => p.code)).size === parties.length, "Duplicate party");
    insist(parties.reduce((s, p) => s + p.votes, otherVotes) === validVotes && validVotes + invalidVotes === totalVotes, "Party and ballot totals do not reconcile");
    if (a.mandatfordelning != null) {
      const seats = list(object(a.mandatfordelning, "mandates").partiLista, "seat parties").map(p => object(p, "seat party"));
      insist(new Set(seats.map(p => p.partikod)).size === seats.length, "Duplicate mandate party");
      const allocated = seats.reduce((s, p) => s + integer(p.antalMandat, "mandates"), 0);
      insist(allocated === 0 || allocated === integer(a.totaltAntalMandat, "total mandates"), "Incomplete mandate allocation");
      for (const s of seats) insist(parties.some(p => p.code === s.partikod) || s.antalMandat === 0, "Mandates for absent party");
      if (allocated > 0) for (const p of parties) {
        const s = seats.find(s => s.partikod === p.code);
        p.seats = s ? integer(s.antalMandat, "party mandates") : 0;
        if (s?.antalFastaMandat != null && s.antalUtjamningsmandat != null) {
          p.fixedSeats = integer(s.antalFastaMandat, "fixed mandates"); p.adjustmentSeats = integer(s.antalUtjamningsmandat, "adjustment mandates");
          insist(p.fixedSeats + p.adjustmentSeats === p.seats, "Mandate components mismatch");
        }
      }
    }
  }
  return { code, name, countedDistricts, totalDistricts, validVotes, invalidVotes, totalVotes, eligibleVoters, eligibleInCountedDistricts, turnoutInCountedDistricts, parties, otherVotes, previous: normalizeComparison(a, previousDate) };
}

export function assertAreaIdentity(raw: unknown, type: ElectionType, stage: CountingStage, now: string) {
  const d = object(raw, "election result");
  insist(d.valtyp === type && d.valdatum === "2026-09-13" && d.valklass === "ordinarie val" && /^Val_(2026|20260913)$/.test(String(d.valtillfalle)) && (d.test === undefined || d.test === false), "Wrong or test election identity");
  insist(d.rakningstillfalle === (stage === "preliminary" ? "preliminär" : "slutlig"), "Wrong counting stage");
  const sourceUpdatedAt = sourceTimestamp(d.senasteUppdateringstid), sourceRevision = integer(d.antalUppdateringar, "revision");
  insist(Date.parse(sourceUpdatedAt) <= Date.parse(now) + 60_000, "Future source revision");
  return { d, sourceUpdatedAt, sourceRevision };
}

export function normalizeAreaResult(raw: unknown, options: { electionType: ElectionType; code: string; stage: CountingStage; now: string; source: LiveResult["source"] }): AreaResult {
  const { d, sourceUpdatedAt, sourceRevision } = assertAreaIdentity(raw, options.electionType, options.stage, options.now);
  const a = object(d.valomrade, "mandate area");
  insist(a.kod === options.code, "Wrong election area");
  const totalSeats = integer(a.totaltAntalMandat, "seat structure");
  insist(totalSeats > 0 && totalSeats <= 501, "Unsupported seat structure");
  const protocolUrl = a.lankTillProtokoll ? string(a.lankTillProtokoll, "protocol") : null;
  insist(protocolUrl === null || /^https:\/\/resultat\.val\.se\/protokoll\/[^\s]+\.pdf$/.test(protocolUrl), "Unexpected protocol origin");
  return { electionType: options.electionType, stage: options.stage, sourceUpdatedAt, sourceRevision, area: normalizeCountedArea(a, d.tidigareValdatum), totalSeats, protocolUrl, municipalities: [], source: options.source, summarySource: null };
}

export function attachMunicipalSummary(result: AreaResult, raw: unknown, source: LiveResult["source"], now: string): void {
  const { d, sourceRevision } = assertAreaIdentity(raw, result.electionType, result.stage, now);
  insist(sourceRevision === result.sourceRevision && source.archiveMd5 === result.source.archiveMd5, "Municipal summary uses a different generation");
  const municipalities = list(d.kommuner, "municipal summary").map(value => {
    const a = object(value, "municipality"), countyCode = string(a.lankod, "county code");
    const normalized = normalizeCountedArea(a, d.tidigareValdatum, true);
    insist(/^\d{4}$/.test(normalized.code) && normalized.code.startsWith(countyCode) && (result.electionType === "RD" || countyCode === result.area.code), "Municipality belongs to wrong county");
    return { ...normalized, countyCode };
  });
  insist(new Set(municipalities.map(m => m.code)).size === municipalities.length, "Duplicate municipality");
  if (result.electionType === "RD") insist(municipalities.length === 290, "Incomplete national municipal summary");
  for (const key of ["validVotes", "invalidVotes", "totalVotes", "eligibleVoters", "eligibleInCountedDistricts", "countedDistricts", "totalDistricts", "otherVotes"] as const) insist(municipalities.reduce((s, m) => s + m[key], 0) === result.area[key], `Municipal summary does not reconcile: ${key}`);
  for (const p of result.area.parties) insist(municipalities.reduce((s, m) => s + (m.parties.find(x => x.code === p.code)?.votes ?? 0), 0) === p.votes, `Municipal party totals disagree: ${p.code}`);
  result.municipalities = municipalities; result.summarySource = source;
}
