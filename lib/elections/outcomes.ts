import archiveJson from "@/data/context/election-outcomes.json";
import { PARTY_IDS, type PartyId } from "@/lib/data/elections/types";

type Bilingual = { sv: string; en: string };
export type ElectionBloc = { id: string; name: Bilingual; parties: PartyId[]; tone: "red" | "blue" | "yellow" };
export type ElectionOutcome = {
  year: number;
  seats: { classification: "OFFICIAL"; sourceId: string; parties: Record<PartyId, number> };
  blocs: ElectionBloc[];
  government: { classification: "CONTEXT"; primeMinister: string; primeMinisterParty: PartyId; parties: PartyId[]; formationDate: string | null; continued: boolean; sources: string[]; note: Bilingual };
};
export type ElectionArchive = {
  schemaVersion: 1; methodVersion: string; reviewedAt: string; totalSeats: number;
  sources: Record<string, { publisher: string; title: Bilingual; url: string; retrievedAt: string; sha256?: string }>;
  elections: ElectionOutcome[];
};
export const electionArchive = archiveJson as ElectionArchive;
export const ARCHIVE_TOTAL_SEATS = 349;
export const ARCHIVE_MAJORITY = 175;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Election archive: ${message}`);
}

/** Sum final allocated seats, using the documented groups for this election. */
export function summarizeElectionOutcome(election: ElectionOutcome) {
  const seats = election.seats.parties;
  assert(election.seats.classification === "OFFICIAL", "missing official seat classification");
  assert(Object.keys(seats).length === PARTY_IDS.length && PARTY_IDS.every(p => Object.hasOwn(seats, p) && Number.isInteger(seats[p]) && seats[p] >= 0), "missing or invalid party seats");
  assert(Object.values(seats).reduce((sum, n) => sum + n, 0) === ARCHIVE_TOTAL_SEATS, "party seats must sum to 349");
  const assigned = new Set<PartyId>();
  assert(election.blocs.length >= 2 && new Set(election.blocs.map(b => b.id)).size === election.blocs.length, "invalid bloc identities");
  const blocs = election.blocs.map(bloc => {
    assert(bloc.parties.length > 0 && bloc.name.sv && bloc.name.en && ["red", "blue", "yellow"].includes(bloc.tone), "invalid bloc metadata");
    for (const party of bloc.parties) {
      assert(PARTY_IDS.includes(party) && !assigned.has(party), "unknown or overlapping bloc party"); assigned.add(party);
    }
    return { ...bloc, seats: bloc.parties.reduce((sum, p) => sum + seats[p], 0) };
  });
  assert(blocs.reduce((sum, b) => sum + b.seats, 0) === ARCHIVE_TOTAL_SEATS, "bloc coverage omits allocated seats");
  const government = election.government;
  assert(government.classification === "CONTEXT" && government.parties.length > 0 && new Set(government.parties).size === government.parties.length, "invalid government context");
  assert(government.parties.every(p => PARTY_IDS.includes(p) && seats[p] > 0) && government.parties.includes(government.primeMinisterParty), "invalid government parties");
  assert(government.primeMinister && government.note.sv && government.note.en, "missing government explanation");
  assert(government.continued ? government.formationDate === null : typeof government.formationDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(government.formationDate) && new Date(government.formationDate).toISOString().slice(0, 10) === government.formationDate, "invalid government formation date");
  const governmentSeats = government.parties.reduce((sum, p) => sum + seats[p], 0);
  const largestSeats = Math.max(...blocs.map(b => b.seats));
  const leaders = blocs.filter(b => b.seats === largestSeats);
  return { ...election, blocs: blocs.filter(b => b.seats > 0), leaders, majority: largestSeats >= ARCHIVE_MAJORITY, governmentSeats, governmentMajority: governmentSeats >= ARCHIVE_MAJORITY };
}

export function validateElectionArchive(archive: ElectionArchive) {
  assert(archive.schemaVersion === 1 && archive.methodVersion === "election-outcomes-1.0.0" && archive.totalSeats === ARCHIVE_TOTAL_SEATS, "unsupported archive version");
  assert(archive.elections.map(e => e.year).join(",") === "2002,2006,2010,2014,2018,2022", "expected all six historical elections");
  for (const election of archive.elections) {
    summarizeElectionOutcome(election);
    assert(archive.sources[election.seats.sourceId]?.publisher === "Valmyndigheten", "seat source must be Valmyndigheten");
    assert(/^[a-f0-9]{64}$/.test(archive.sources[election.seats.sourceId]?.sha256 ?? ""), "missing official source checksum");
    assert(election.government.sources.length > 0, "government must have sources");
    for (const id of [election.seats.sourceId, ...election.government.sources]) {
      const source = archive.sources[id];
      assert(source && source.title.sv && source.title.en && source.retrievedAt, "missing source metadata");
      assert(["www.val.se", "www.riksdagen.se", "regeringen.se", "www.regeringen.se"].includes(new URL(source.url).hostname), "unexpected source publisher URL");
    }
  }
}

export function getElectionOutcome(year: number) {
  const election = electionArchive.elections.find(e => e.year === year);
  assert(election, `no reviewed outcome for ${year}`);
  return summarizeElectionOutcome(election);
}
