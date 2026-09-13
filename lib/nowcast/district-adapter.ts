import {
  NOWCAST_PARTIES,
  type BaselineUnit,
  type Observation,
  type Votes,
} from "./types";
import { PARTY_CODE_TO_ID } from "../live/constants";
import {
  insist,
  integer,
  list,
  object,
  sourceTimestamp,
  string,
  checkRoundedPercent,
  percent,
} from "../live/validation";
import type { FeedMode, LiveResult } from "../live/types";

/** Official preliminary district schema, published 14 April 2026. No guessed joins. */
export function normalizeDistricts(
  raw: unknown,
  result: LiveResult,
  baseline: BaselineUnit[],
  mode: FeedMode,
  now: string,
): { observations: Observation[]; revision: number; updatedAt: string } {
  const r = object(raw, "district file");
  insist(
    r.valtyp === "RD" &&
      r.valdatum === "2026-09-13" &&
      r.valklass === "ordinarie val" &&
      r.rakningstillfalle === "preliminär",
    "Wrong district election identity",
  );
  insist(
    mode === "production"
      ? (r.test === undefined || r.test === false) &&
          /^Val_(2026|20260913)$/.test(String(r.valtillfalle))
      : r.test === true && r.valtillfalle === "Genrep_2026",
    "Wrong district test identity",
  );
  const updatedAt = sourceTimestamp(r.senasteUppdateringstid);
  insist(
    Date.parse(updatedAt) <= Date.parse(now) + 60_000,
    "Future district source",
  );
  const revision = integer(r.antalUppdateringar, "district revision");
  const physical = new Map(
    baseline.filter((d) => !d.collection).map((d) => [d.code, d]),
  );
  const collectionParents = new Set(
    baseline
      .filter((d) => d.collection)
      .map((d) => `${d.municipality}/${d.constituency}`),
  );
  const rows = list(r.valdistrikt, "district array");
  insist(rows.length <= 8000, "Unexpected district volume");
  let validTotal = 0,
    invalidTotal = 0,
    eligibleTotal = 0;
  const areaTotals = new Map<
    string,
    {
      votes: Votes;
      valid: number;
      invalid: number;
      counted: number;
      total: number;
      eligible: number;
      countedEligible: number;
    }
  >();
  const observations = rows.map((value) => {
    const d = object(value, "district");
    const code = string(d.valdistriktskod, "district code");
    const municipality = string(d.kommunkod, "municipality"),
      constituency = string(d.kretskod, "constituency");
    const kind = string(d.valdistriktstyp, "district kind").toLocaleLowerCase(
      "sv-SE",
    );
    insist(
      kind === "valdistrikt" || kind === "uppsamlingsdistrikt",
      "Unknown district kind",
    );
    const collection = kind === "uppsamlingsdistrikt";
    const b = physical.get(code);
    insist(
      collection
        ? collectionParents.has(`${municipality}/${constituency}`)
        : Boolean(
            b &&
              b.municipality === municipality &&
              b.constituency === constituency,
          ),
      "Unreviewed district geography",
    );
    const reported =
      d.rapporteringsTid !== null &&
      d.rapporteringsTid !== undefined &&
      d.rapporteringsTid !== "";
    if (reported)
      insist(
        sourceTimestamp(d.rapporteringsTid) <= updatedAt,
        "District reported after file time",
      );
    const eligible = collection
      ? null
      : integer(d.antalRostberattigade, "district electorate");
    insist(
      !collection || d.antalRostberattigade === null,
      "Collection rows must not add an electorate",
    );
    const unreportedEmpty = d.rostfordelning === null;
    insist(
      !unreportedEmpty || (!reported && d.totaltAntalRoster === 0),
      "Missing distribution for a reported district",
    );
    // Empty production rows contribute zero counted votes, with reported=false.
    // Keep their geography/electorate so remaining districts stay in the model.
    const distribution = unreportedEmpty
      ? {
          rosterPaverkaMandat: { antalRoster: 0, partiRoster: [] },
          rosterEjPaverkaMandat: { antalRoster: 0 },
        }
      : object(d.rostfordelning, "district distribution");
    const valid = object(
      distribution.rosterPaverkaMandat,
      "valid district votes",
    );
    const invalid = integer(
      object(distribution.rosterEjPaverkaMandat, "invalid district votes")
        .antalRoster,
      "invalid votes",
    );
    const total = integer(valid.antalRoster, "valid votes");
    insist(
      total + invalid === integer(d.totaltAntalRoster, "district all votes"),
      "District totals disagree",
    );
    insist(
      reported || (total === 0 && invalid === 0),
      "Unreported district contains votes",
    );
    insist(
      eligible === null || total + invalid <= eligible,
      "Impossible district turnout",
    );
    const votes = Object.fromEntries(
      NOWCAST_PARTIES.map((p) => [p, 0]),
    ) as Votes;
    const seen = new Set<string>();
    for (const item of list(valid.partiRoster, "district party votes")) {
      const p = object(item, "party");
      const partyCode = string(p.partikod, "party code");
      insist(
        /^\d{4}$/.test(partyCode) && !seen.has(partyCode),
        "Invalid/duplicate district party",
      );
      seen.add(partyCode);
      const count = integer(p.antalRoster, "party count");
      checkRoundedPercent(
        p.andelRoster,
        percent(count, total),
        "district party share",
      );
      votes[PARTY_CODE_TO_ID[partyCode] ?? "OTHER"] += count;
    }
    if (valid.rosterOvrigaPartier != null)
      votes.OTHER += integer(
        object(valid.rosterOvrigaPartier, "other votes").antalRoster,
        "other count",
      );
    insist(
      Object.values(votes).reduce((a, b) => a + b, 0) === total,
      "District parties do not reconcile",
    );
    validTotal += total;
    invalidTotal += invalid;
    eligibleTotal += eligible ?? 0;
    const area = areaTotals.get(constituency) ?? {
      votes: Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0])) as Votes,
      valid: 0,
      invalid: 0,
      counted: 0,
      total: 0,
      eligible: 0,
      countedEligible: 0,
    };
    area.valid += total;
    area.invalid += invalid;
    area.counted += Number(reported);
    area.total++;
    area.eligible += eligible ?? 0;
    if (reported) area.countedEligible += eligible ?? 0;
    for (const p of NOWCAST_PARTIES) area.votes[p] += votes[p];
    areaTotals.set(constituency, area);
    return {
      code,
      municipality,
      constituency,
      eligible,
      votes,
      reported,
      collection,
    };
  });
  insist(
    new Set(observations.map((o) => o.code)).size === rows.length,
    "Duplicate district",
  );
  insist(
    observations.filter((o) => !o.collection).length === physical.size,
    "Incomplete physical district coverage",
  );
  const counted = observations.filter((o) => o.reported).length;
  insist(
    integer(r.antalValdistriktRaknade, "counted districts") === counted &&
      counted === result.national.countedDistricts,
    "Counted district files disagree",
  );
  insist(
    integer(r.antalValdistriktSomSkaRaknas, "total districts") ===
      rows.length && rows.length === result.national.totalDistricts,
    "District coverage files disagree",
  );
  insist(
    validTotal === result.national.validVotes &&
      invalidTotal === result.national.invalidVotes &&
      eligibleTotal === result.national.eligibleVoters,
    "National/district files disagree",
  );
  for (const c of result.constituencies) {
    const a = areaTotals.get(c.code);
    insist(
      a &&
        a.valid === c.validVotes &&
        a.invalid === c.invalidVotes &&
        a.counted === c.countedDistricts &&
        a.total === c.totalDistricts &&
        a.eligible === c.eligibleVoters &&
        a.countedEligible === c.eligibleInCountedDistricts,
      "Constituency/district files disagree",
    );
    const official = Object.fromEntries(
      NOWCAST_PARTIES.map((p) => [p, 0]),
    ) as Votes;
    official.OTHER = c.otherVotes;
    for (const p of c.parties)
      official[PARTY_CODE_TO_ID[p.code] ?? "OTHER"] += p.votes;
    insist(
      NOWCAST_PARTIES.every((p) => official[p] === a.votes[p]),
      "Constituency party files disagree",
    );
  }
  return { observations, revision, updatedAt };
}
