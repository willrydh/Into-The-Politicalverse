import { writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { history } from "../lib/nowcast/baseline";
import { projectVotes } from "../lib/nowcast/model";
import {
  NOWCAST_PARTIES,
  type BaselineUnit,
  type Observation,
  type Votes,
  type StressReport,
} from "../lib/nowcast/types";
const districts = history.filter(
  (d) =>
    d.level === "district" &&
    d.results.some((r) => r.year === 2018) &&
    d.results.some((r) => r.year === 2022),
);
const units: BaselineUnit[] = districts.map((d) => {
  const p = d.results.find((r) => r.year === 2018)!,
    c = d.results.find((r) => r.year === 2022)!;
  return {
    code: d.code,
    municipality: d.parent,
    constituency: d.constituencies[0],
    eligible: c.eligibleVoters,
    baselineEligible: p.eligibleVoters,
    votes: p.votes,
    matched: true,
    collection: false,
  };
});
const actual = new Map(
  districts.map((d) => [d.code, d.results.find((r) => r.year === 2022)!]),
);
const zero = () =>
  Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0])) as Votes;
const totals = zero();
for (const a of actual.values())
  for (const p of NOWCAST_PARTIES) totals[p] += a.votes[p];
const n = Object.values(totals).reduce((a, b) => a + b, 0);
const bySize = (a: BaselineUnit, b: BaselineUnit) =>
  a.baselineEligible - b.baselineEligible || a.code.localeCompare(b.code);
const left = (d: BaselineUnit) =>
  (d.votes.S + d.votes.V + d.votes.MP) /
  Object.values(d.votes).reduce((a, b) => a + b, 0);
const orders: {
  name: string;
  compare: (a: BaselineUnit, b: BaselineUnit) => number;
}[] = [
  { name: "prior-electorate-ascending", compare: bySize },
  { name: "prior-electorate-descending", compare: (a, b) => bySize(b, a) },
  {
    name: "municipality-ascending",
    compare: (a, b) => a.code.localeCompare(b.code),
  },
  {
    name: "municipality-descending",
    compare: (a, b) => b.code.localeCompare(a.code),
  },
  {
    name: "prior-left-share-ascending",
    compare: (a, b) => left(a) - left(b) || bySize(a, b),
  },
  {
    name: "prior-left-share-descending",
    compare: (a, b) => left(b) - left(a) || bySize(a, b),
  },
];
const checkpoints: StressReport["checkpoints"] = [];
for (const coverage of [0.01, 0.05, 0.1, 0.2, 0.5, 0.8, 1]) {
  let rawMae = 0,
    modelMae = 0;
  const maxPartyError = zero();
  const remainingShareErrors: Votes[] = [];
  for (const order of orders) {
    const sorted = [...units].sort(order.compare);
    // Stop by baseline-weighted vote exposure, not future party shares or votes.
    const exposure = (d: BaselineUnit) =>
      (Object.values(d.votes).reduce((a, b) => a + b, 0) * d.eligible) /
      d.baselineEligible;
    const target = units.reduce((s, d) => s + exposure(d), 0) * coverage;
    let counted = 0;
    const selected = new Set<string>();
    for (const d of sorted) {
      if (counted >= target) break;
      selected.add(d.code);
      counted += exposure(d);
    }
    const observations: Observation[] = units.map((d) => ({
      code: d.code,
      municipality: d.municipality,
      constituency: d.constituency,
      eligible: d.eligible,
      votes: selected.has(d.code) ? actual.get(d.code)!.votes : zero(),
      reported: selected.has(d.code),
      collection: false,
    }));
    const result = projectVotes(units, observations, undefined, {
      estimator: "national",
    }).estimate;
    const errors = zero();
    const remainingFraction =
      result.estimatedRemainingVotes /
      (result.countedVotes + result.estimatedRemainingVotes);
    for (const row of result.rows) {
      const truth = (totals[row.partyId] / n) * 100;
      errors[row.partyId] =
        remainingFraction > 0
          ? (truth - row.projectedShare) / remainingFraction
          : 0;
      maxPartyError[row.partyId] = Math.max(
        maxPartyError[row.partyId],
        Math.abs(row.projectedShare - truth),
      );
      if (row.partyId !== "OTHER") {
        rawMae += Math.abs(row.countedShare! - truth) / 8 / orders.length;
        modelMae += Math.abs(row.projectedShare - truth) / 8 / orders.length;
      }
    }
    remainingShareErrors.push(errors);
  }
  checkpoints.push({
    coverage,
    rawMae,
    modelMae,
    maxPartyError,
    remainingShareErrors,
  });
}
const report = {
  methodVersion: "pv-nowcast-1.1.0",
  scope:
    "2018–2022 comparable physical districts only; six synthetic reporting orders, no real-time replay, excludes collection votes and changed boundaries. Calibration stress test, not independent validation.",
  districts: units.length,
  orders: orders.map((o) => o.name),
  sourceSha256: createHash("sha256")
    .update(await readFile("data/normalized/local-election-districts.json"))
    .digest("hex"),
  checkpoints,
};
const serialized = JSON.stringify(report, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (
    serialized !==
    (await readFile("data/normalized/election-nowcast-stress-v1.json", "utf8"))
  )
    throw new Error("Nowcast stress report is stale");
} else
  await writeFile(
    "data/normalized/election-nowcast-stress-v1.json",
    serialized,
  );
console.log(
  JSON.stringify({
    districts: report.districts,
    checkpoints: checkpoints.map(({ coverage, rawMae, modelMae }) => ({
      coverage,
      rawMae,
      modelMae,
    })),
  }),
);
