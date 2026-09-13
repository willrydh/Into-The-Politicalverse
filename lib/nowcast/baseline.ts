import { createHash } from "node:crypto";
import localData from "../../data/normalized/local-election-districts.json";
import preparation from "../../data/normalized/election-preparation-2026.json";
import { NOWCAST_PARTIES, type BaselineUnit, type Votes } from "./types";
import { insist } from "../live/validation";
export const zeroVotes = (): Votes =>
  Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0])) as Votes;
export const sumVotes = (v: Votes) =>
  NOWCAST_PARTIES.reduce((s, p) => s + v[p], 0);
export type HistoryResult = {
  year: number;
  validVotes: number;
  eligibleVoters: number;
  votes: Votes;
};
export type HistoryDistrict = {
  code: string;
  parent: string;
  level: string;
  constituencies: string[];
  results: HistoryResult[];
};
export const history = Object.values(
  localData.municipalities,
).flat() as HistoryDistrict[];
export function buildBaseline(): BaselineUnit[] {
  const old = new Map(
    history.filter((d) => d.level === "district").map((d) => [d.code, d]),
  );
  const municipalities = new Map<string, { eligible: number; votes: Votes }>();
  for (const d of old.values()) {
    const r = d.results.find((r) => r.year === 2022)!;
    const m = municipalities.get(d.parent) ?? {
      eligible: 0,
      votes: zeroVotes(),
    };
    m.eligible += r.eligibleVoters;
    for (const p of NOWCAST_PARTIES) m.votes[p] += r.votes[p];
    municipalities.set(d.parent, m);
  }
  // Only unique official predecessor sets may teach the swing. Split or ambiguous
  // boundaries use the municipality baseline and are excluded from estimation.
  const uses = new Map<string, number>();
  for (const d of preparation.districts.filter((d) => d.comparableTo2022))
    for (const code of d.previousDistricts)
      uses.set(code, (uses.get(code) ?? 0) + 1);
  const units: BaselineUnit[] = preparation.districts.map((d) => {
    const previous = d.previousDistricts.map((code) =>
      old.get(code)?.results.find((r) => r.year === 2022),
    );
    const matched =
      d.comparableTo2022 &&
      previous.length > 0 &&
      previous.every(Boolean) &&
      d.previousDistricts.every((code) => uses.get(code) === 1);
    let eligible = 0;
    const votes = zeroVotes();
    if (matched)
      for (const r of previous) {
        eligible += r!.eligibleVoters;
        for (const p of NOWCAST_PARTIES) votes[p] += r!.votes[p];
      }
    else {
      const m = municipalities.get(d.municipality);
      insist(m, "Missing municipality baseline");
      eligible = m.eligible;
      Object.assign(votes, m.votes);
    }
    insist(eligible > 0 && sumVotes(votes) > 0, "Empty baseline");
    return {
      code: d.code,
      municipality: d.municipality,
      constituency: d.constituency,
      eligible: d.eligibleVoters,
      baselineEligible: eligible,
      votes,
      matched,
      collection: false,
    };
  });
  for (const d of history.filter((d) => d.level === "collection")) {
    const r = d.results.find((r) => r.year === 2022)!;
    const current = preparation.municipalities.find(
      (m) => m.code === d.parent,
    )!;
    const previous = municipalities.get(d.parent)!;
    insist(
      d.constituencies.length === 1 &&
        units
          .filter((u) => u.municipality === d.parent)
          .every((u) => u.constituency === d.constituencies[0]),
      "Ambiguous collection constituency",
    );
    // Collection ballots have no separate electoral roll. Scale their historical
    // volume by municipal electorate growth, never add them as extra electors.
    units.push({
      code: d.code,
      municipality: d.parent,
      constituency: d.constituencies[0],
      eligible: 0,
      baselineEligible: 0,
      votes: Object.fromEntries(
        NOWCAST_PARTIES.map((p) => [
          p,
          (r.votes[p] * current.total) / previous.eligible,
        ]),
      ) as Votes,
      matched: false,
      collection: true,
    });
  }
  insist(
    units.filter((d) => !d.collection).length === 6312,
    "Incomplete 2026 baseline",
  );
  return units;
}
export const baseline = buildBaseline();
export const baselineSha256 = createHash("sha256")
  .update(
    JSON.stringify({
      units: baseline,
      sources: [localData.source, preparation.source],
    }),
  )
  .digest("hex");
