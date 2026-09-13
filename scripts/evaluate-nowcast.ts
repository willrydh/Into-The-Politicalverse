import type { SwingDiagnostics } from "../lib/nowcast/adaptive-swing";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { projectVotes } from "../lib/nowcast/model";
import {
  NOWCAST_PARTIES,
  NOWCAST_VERSION,
  type BaselineUnit,
  type Observation,
  type Votes,
} from "../lib/nowcast/types";

const blank = () =>
  Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0])) as Votes;
const total = (v: Votes) => NOWCAST_PARTIES.reduce((s, p) => s + v[p], 0);
const sum = (items: number[]) => items.reduce((s, v) => s + v, 0);
const mean = (items: number[]) => sum(items) / items.length;
const hash = (s: string, seed = 2166136261) => {
  let h = seed;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};
const exposure = (u: BaselineUnit) =>
  (total(u.votes) * u.eligible) / u.baselineEligible;
type HistoricalUnit = BaselineUnit & { actual: Votes; final?: Votes };
const inputPath = "data/normalized/nowcast-evaluation-history.json";
const input = await readFile(inputPath);
const manifest = JSON.parse(
  await readFile(
    "data/raw/valmyndigheten-2026/nowcast-evaluation-manifest.json",
    "utf8",
  ),
);
for (const source of manifest.dependencies as {
  path: string;
  sha256: string;
}[])
  assert.equal(
    createHash("sha256")
      .update(await readFile(source.path))
      .digest("hex"),
    source.sha256,
    `Historical dependency changed: ${source.path}`,
  );
const inputSha256 = createHash("sha256").update(input).digest("hex");
assert.equal(
  inputSha256,
  manifest.output.sha256,
  "Historical evaluation checksum mismatch",
);
const history = JSON.parse(input.toString()) as {
  scope: string;
  elections: { year: number; baselineYear: number; units: HistoricalUnit[] }[];
};
const checkpoints = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 0.8, 1];
const quick = process.argv.includes("--quick");
const score = (predicted: Votes, truth: Votes) => {
  const a = total(predicted),
    b = total(truth);
  const errors = Object.fromEntries(
    NOWCAST_PARTIES.map((p) => [p, 100 * (predicted[p] / a - truth[p] / b)]),
  ) as Votes;
  return {
    partyMaePp: mean(
      NOWCAST_PARTIES.filter((p) => p !== "OTHER").map((p) =>
        Math.abs(errors[p]),
      ),
    ),
    blocErrorPp: Math.abs(errors.S + errors.V + errors.MP + errors.C),
    worstPartyErrorPp: Math.max(...Object.values(errors).map(Math.abs)),
    errors,
  };
};
type Case = {
  order: string;
  coverage: number;
  reported: number;
  representedConstituencies: number;
  ready: boolean;
  raw: ReturnType<typeof score>;
  national: ReturnType<typeof score>;
  adaptive: ReturnType<typeof score>;
  againstFinal: ReturnType<typeof score>;
  remainingShareErrors: Votes;
  diagnostics: Omit<SwingDiagnostics, "clusterResidualsPp"> & {
    clusterResidualsPp?: undefined;
  };
};
type Summary = {
  coverage: number;
  nationalMaePp: number;
  adaptiveMaePp: number;
  rawMaePp: number;
  nationalBlocErrorPp: number;
  adaptiveBlocErrorPp: number;
  worstAdaptivePartyErrorPp: number;
  worseOrders: string[];
  publishedCases: number;
  publishedNationalMaePp: number | null;
  publishedAdaptiveMaePp: number | null;
  publishedWorstPartyErrorPp: number | null;
  againstFinalMaePp: number;
};
const elections: {
  year: number;
  baselineYear: number;
  districts: number;
  summaries: Summary[];
  cases: Case[];
}[] = [];
for (const election of history.elections) {
  const units: BaselineUnit[] = election.units.map((u) => ({
    code: u.code,
    municipality: u.municipality,
    constituency: u.constituency,
    eligible: u.eligible,
    baselineEligible: u.baselineEligible,
    votes: u.votes,
    matched: u.matched,
    collection: u.collection,
  }));
  const actual = new Map(election.units.map((u) => [u.code, u.actual]));
  const truth = blank(),
    final = blank();
  for (const u of election.units)
    for (const p of NOWCAST_PARTIES) {
      truth[p] += u.actual[p];
      final[p] += (u.final ?? u.actual)[p];
    }
  const size = (u: BaselineUnit) => u.baselineEligible;
  const left = (u: BaselineUnit) =>
    (u.votes.S + u.votes.V + u.votes.MP) / total(u.votes);
  const ranks: {
    name: string;
    value: (u: BaselineUnit) => number | string;
    reverse?: boolean;
  }[] = [
    { name: "prior-electorate-ascending", value: size },
    { name: "prior-electorate-descending", value: size, reverse: true },
    { name: "municipality-ascending", value: (u) => u.code },
    { name: "municipality-descending", value: (u) => u.code, reverse: true },
    { name: "prior-left-share-ascending", value: left },
    { name: "prior-left-share-descending", value: left, reverse: true },
    ...[41, 109, 251, 503, 1009, 2017].map((seed) => ({
      name: `interleaved-size-seed-${seed}`,
      value: (u: BaselineUnit) =>
        Math.log(Math.max(1, u.baselineEligible)) +
        0.9 * Math.log((hash(u.code, seed) + 0.5) / 4294967296),
    })),
  ];
  const cases: Case[] = [];
  const expected = units.reduce((s, u) => s + exposure(u), 0);
  for (const order of quick ? ranks.slice(0, 2) : ranks) {
    const sorted = [...units].sort((a, b) => {
      const av = order.value(a),
        bv = order.value(b);
      const v = av < bv ? -1 : av > bv ? 1 : a.code.localeCompare(b.code);
      return order.reverse ? -v : v;
    });
    for (const coverage of quick ? [0.01, 0.05, 0.2] : checkpoints) {
      const selected = new Set<string>();
      let counted = 0;
      for (const u of sorted) {
        if (counted >= expected * coverage) break;
        selected.add(u.code);
        counted += exposure(u);
      }
      const observations: Observation[] = units.map((u) => ({
        code: u.code,
        municipality: u.municipality,
        constituency: u.constituency,
        eligible: u.eligible,
        votes: selected.has(u.code) ? actual.get(u.code)! : blank(),
        reported: selected.has(u.code),
        collection: false,
      }));
      const national = projectVotes(units, observations, undefined, {
        estimator: "national",
      }).estimate;
      const adaptive = projectVotes(units, observations).estimate;
      const projected = (e: typeof adaptive) =>
        Object.fromEntries(
          e.rows.map((r) => [r.partyId, r.projectedVotes]),
        ) as Votes;
      const countedVotes = Object.fromEntries(
        adaptive.rows.map((r) => [r.partyId, r.countedVotes]),
      ) as Votes;
      const n = score(projected(national), truth),
        a = score(projected(adaptive), truth),
        f = score(projected(adaptive), final);
      const remainder =
        adaptive.estimatedRemainingVotes /
        (adaptive.estimatedRemainingVotes + adaptive.countedVotes);
      const remainingShareErrors = Object.fromEntries(
        NOWCAST_PARTIES.map((p) => [
          p,
          remainder > 1e-8 ? -a.errors[p] / remainder : 0,
        ]),
      ) as Votes;
      const diagnostics = adaptive.diagnostics!;
      cases.push({
        order: order.name,
        coverage,
        reported: selected.size,
        representedConstituencies: adaptive.representedConstituencies,
        ready: adaptive.status !== "insufficient",
        raw: score(countedVotes, truth),
        national: n,
        adaptive: a,
        againstFinal: f,
        remainingShareErrors,
        diagnostics: { ...diagnostics, clusterResidualsPp: undefined },
      });
    }
    console.log(`${election.year} ${order.name} evaluated`);
  }
  const summaries = (quick ? [0.01, 0.05, 0.2] : checkpoints).map(
    (coverage) => {
      const slice = cases.filter((c) => c.coverage === coverage);
      return {
        coverage,
        nationalMaePp: mean(slice.map((c) => c.national.partyMaePp)),
        adaptiveMaePp: mean(slice.map((c) => c.adaptive.partyMaePp)),
        rawMaePp: mean(slice.map((c) => c.raw.partyMaePp)),
        nationalBlocErrorPp: mean(slice.map((c) => c.national.blocErrorPp)),
        adaptiveBlocErrorPp: mean(slice.map((c) => c.adaptive.blocErrorPp)),
        worstAdaptivePartyErrorPp: Math.max(
          ...slice.map((c) => c.adaptive.worstPartyErrorPp),
        ),
        worseOrders: slice
          .filter((c) => c.adaptive.partyMaePp > c.national.partyMaePp + 1e-7)
          .map((c) => c.order),
        publishedCases: slice.filter((c) => c.ready).length,
        publishedNationalMaePp: slice.some((c) => c.ready)
          ? mean(slice.filter((c) => c.ready).map((c) => c.national.partyMaePp))
          : null,
        publishedAdaptiveMaePp: slice.some((c) => c.ready)
          ? mean(slice.filter((c) => c.ready).map((c) => c.adaptive.partyMaePp))
          : null,
        publishedWorstPartyErrorPp: slice.some((c) => c.ready)
          ? Math.max(
              ...slice
                .filter((c) => c.ready)
                .map((c) => c.adaptive.worstPartyErrorPp),
            )
          : null,
        againstFinalMaePp: mean(slice.map((c) => c.againstFinal.partyMaePp)),
      };
    },
  );
  elections.push({
    year: election.year,
    baselineYear: election.baselineYear,
    districts: units.length,
    summaries,
    cases,
  });
  console.log(JSON.stringify({ year: election.year, summaries }));
}
if (quick) process.exit(0);
const sourceFiles = [
  "lib/nowcast/adaptive-swing.ts",
  "lib/nowcast/model.ts",
  "lib/nowcast/readiness.ts",
  "lib/nowcast/types.ts",
  "lib/nowcast/probability.ts",
  "scripts/evaluate-nowcast.ts",
];
const codeHash = createHash("sha256");
for (const file of sourceFiles)
  codeHash.update(file + "\n").update(await readFile(file));
const report = {
  methodVersion: NOWCAST_VERSION,
  inputSha256,
  implementationSha256: codeHash.digest("hex"),
  scope: history.scope,
  ordersPerElection: 12,
  checkpoints,
  elections,
};
const stress = {
  methodVersion: NOWCAST_VERSION,
  scope:
    "2014–2018 and 2018–2022 comparable physical districts; 12 synthetic reporting orders per election. Development stress evidence, not real-time replay or independently calibrated uncertainty. Collection and changed boundaries excluded.",
  districts: sum(elections.map((e) => e.districts)),
  orders: elections.flatMap((e) => [
    ...new Set(e.cases.map((c) => `${e.year}:${c.order}`)),
  ]),
  sourceSha256: inputSha256,
  checkpoints: checkpoints.map((coverage) => {
    const cases = elections.flatMap((e) =>
      e.cases.filter((c) => c.coverage === coverage),
    );
    return {
      coverage,
      rawMae: mean(cases.map((c) => c.raw.partyMaePp)),
      modelMae: mean(cases.map((c) => c.adaptive.partyMaePp)),
      maxPartyError: Object.fromEntries(
        NOWCAST_PARTIES.map((p) => [
          p,
          Math.max(...cases.map((c) => Math.abs(c.adaptive.errors[p]))),
        ]),
      ) as Votes,
      remainingShareErrors: cases.map((c) => c.remainingShareErrors),
    };
  }),
};
// Reports are rounded for deterministic verification across supported Node/CPU
// runtimes. Fitting and production projections retain full floating precision.
const serialize = (value: unknown) =>
  JSON.stringify(
    value,
    (_k, v) => (typeof v === "number" ? Math.round(v * 1e8) / 1e8 : v),
    2,
  ) + "\n";
const summary = {
  methodVersion: NOWCAST_VERSION,
  districts: stress.districts,
  elections: elections.map((e) => ({
    year: e.year,
    districts: e.districts,
    summaries: e.summaries,
  })),
  checkpoints: checkpoints.map((coverage) => {
    const rows = elections.map(
      (e) => e.summaries.find((c) => c.coverage === coverage)!,
    );
    return {
      coverage,
      nationalMaePp: mean(rows.map((r) => r.nationalMaePp)),
      adaptiveMaePp: mean(rows.map((r) => r.adaptiveMaePp)),
      worseOrders: sum(rows.map((r) => r.worseOrders.length)),
      cases: 24,
      publishedCases: sum(rows.map((r) => r.publishedCases)),
    };
  }),
};
for (const [path, data] of [
  ["data/normalized/election-nowcast-evaluation.json", report],
  ["data/normalized/election-nowcast-evaluation-summary.json", summary],
  ["data/normalized/election-nowcast-stress.json", stress],
] as const) {
  const text = serialize(data);
  if (process.argv.includes("--check"))
    assert.equal(
      await readFile(path, "utf8"),
      text,
      `Stale evaluation: ${path}`,
    );
  else await writeFile(path, text);
}
