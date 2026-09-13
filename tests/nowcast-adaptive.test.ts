import test from "node:test";
import assert from "node:assert/strict";
import { projectVotes } from "../lib/nowcast/model";
import { nowcastReady } from "../lib/nowcast/readiness";
import { evaluateNowcastOutcome } from "../lib/nowcast/audit";
import {
  NOWCAST_PARTIES,
  type BaselineUnit,
  type Observation,
  type Votes,
} from "../lib/nowcast/types";
import type { LiveResult } from "../lib/live/types";

// Deliberately synthetic relationships for invariants; never production data.
const votes = (s = 0, m = 0) =>
  ({
    ...Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0])),
    S: s,
    M: m,
  }) as Votes;
function example(districtsPerMunicipality = 10) {
  const units: BaselineUnit[] = Array.from(
    { length: 30 * districtsPerMunicipality },
    (_, i) => {
      const municipality = String(
          1000 + Math.floor(i / districtsPerMunicipality),
        ),
        s =
          120 +
          ((i % districtsPerMunicipality) * 700) / districtsPerMunicipality;
      return {
        code:
          municipality + String(i % districtsPerMunicipality).padStart(4, "0"),
        municipality,
        constituency: String(
          Math.floor(i / districtsPerMunicipality) % 10,
        ).padStart(2, "0"),
        eligible: 1250,
        baselineEligible: 1250,
        votes: votes(Math.round(s), 1000 - Math.round(s)),
        matched: true,
        collection: false,
      };
    },
  );
  const actual = (u: BaselineUnit) => {
    const s = Math.round(u.votes.S * 0.8 + 80);
    return votes(s, 1000 - s);
  };
  const observations: Observation[] = units.map((u, i) => ({
    code: u.code,
    municipality: u.municipality,
    constituency: u.constituency,
    eligible: u.eligible,
    collection: false,
    reported: i % districtsPerMunicipality < 2,
    votes: i % districtsPerMunicipality < 2 ? actual(u) : votes(),
  }));
  return { units, observations, actual };
}
test("district composition regression corrects a biased early sample beyond common national swing", () => {
  const { units, observations, actual } = example();
  const baseline = projectVotes(units, observations, undefined, {
    estimator: "national",
  }).estimate;
  const candidate = projectVotes(units, observations).estimate;
  const truth =
    units.reduce((s, u) => s + actual(u).S, 0) / (units.length * 10);
  const error = (e: typeof candidate) =>
    Math.abs(e.rows.find((r) => r.partyId === "S")!.projectedShare - truth);
  assert.equal(candidate.diagnostics!.estimator, "regularized-geographic");
  assert.ok(error(candidate) < error(baseline));
  assert.equal(
    candidate.status,
    "insufficient",
    "A narrowly sampled historical composition must not pass the publication gate",
  );
  assert.ok(candidate.diagnostics!.extrapolatedVoteShare > 0.25);
  assert.ok(
    candidate.diagnostics!.crossValidationMaePp! <
      candidate.diagnostics!.nationalCrossValidationMaePp!,
  );
  assert.ok(candidate.rows.every((r) => r.projectedVotes >= r.countedVotes));
  assert.ok(
    Math.abs(candidate.rows.reduce((s, r) => s + r.projectedShare, 0) - 100) <
      1e-8,
  );
});
test("early publication requires effective sample size and geographic support as well as vote coverage", () => {
  const { units, observations, actual } = example(60);
  for (let i = 0; i < observations.length; i++) {
    const reported = i % 60 === 0 || i % 60 === 59;
    observations[i] = {
      ...observations[i],
      reported,
      votes: reported ? actual(units[i]) : votes(),
    };
  }
  const e = projectVotes(units, observations).estimate;
  assert.ok(e.matchedCoverage < 0.05 && e.matchedCoverage >= 0.01);
  assert.equal(e.matchedDistricts, 60);
  assert.equal(e.status, "experimental");
  for (const diagnostics of [
    { ...e.diagnostics!, effectiveDistricts: 39 },
    { ...e.diagnostics!, municipalities: 19 },
    { ...e.diagnostics!, extrapolatedVoteShare: 0.26 },
    { ...e.diagnostics!, crossValidationMaePp: null },
  ])
    assert.equal(nowcastReady({ ...e, diagnostics }), false);
  assert.equal(nowcastReady({ ...e, comparableReportedShare: 0.69 }), false);
  assert.equal(nowcastReady({ ...e, representedConstituencies: 7 }), false);
  assert.equal(nowcastReady({ ...e, matchedCoverage: 0.009 }), false);
});
test("no current unreported outcomes enter fitting, and corrected counts rebuild without stale model state", () => {
  const { units, observations } = example();
  const original = structuredClone({ units, observations });
  const first = projectVotes(units, observations).estimate;
  const poisoned = units.map((u) => ({
    ...u,
    actual: votes(999999, 1),
    final: votes(1, 999999),
  }));
  assert.deepEqual(projectVotes(poisoned, observations).estimate, first);
  const corrected = structuredClone(observations);
  corrected[0].votes = votes(150, 850);
  assert.notDeepEqual(projectVotes(units, corrected).estimate.rows, first.rows);
  assert.deepEqual(projectVotes(units, observations).estimate, first);
  assert.deepEqual({ units, observations }, original);
  const illegal = structuredClone(observations);
  illegal.find((o) => !o.reported)!.votes = votes(1, 1);
  assert.throws(() => projectVotes(units, illegal), /Unreported/);
  const reversed = projectVotes(
    [...units].reverse(),
    [...observations].reverse(),
  ).estimate;
  for (const p of first.rows)
    assert.ok(
      Math.abs(
        p.projectedShare -
          reversed.rows.find((r) => r.partyId === p.partyId)!.projectedShare,
      ) < 1e-8,
    );
});
test("missing electoral rolls do not teach turnout, and empty physical samples retain a safe fallback", () => {
  const { units, observations } = example();
  const e = projectVotes(
    units,
    observations.map((o) => ({ ...o, eligible: null })),
  ).estimate;
  assert.equal(e.matchedDistricts, 0);
  assert.ok(
    Object.values(e.diagnostics!.modelDisagreementPp).every((v) => v === 0),
  );
  assert.equal(e.status, "insufficient");
  assert.ok(e.rows.every((r) => Number.isFinite(r.projectedShare)));
  const collection = {
    ...units[0],
    code: "1000-collection",
    eligible: 0,
    baselineEligible: 0,
    collection: true,
    matched: false,
  };
  const only = projectVotes([collection], []).estimate;
  assert.equal(only.estimatedCollectionVotes, 1000);
  assert.equal(only.status, "insufficient");
  assert.throws(
    () => projectVotes([{ ...units[0], baselineEligible: 0 }], []),
    /baseline/,
  );
});
test("outcome audits refuse partial, preliminary and retrospectively produced predictions", () => {
  const { units, observations } = example();
  const e = projectVotes(units, observations).estimate;
  e.status = "experimental"; // Isolate the archived-outcome policy from the support-gate tests above.
  const r = {
    stage: "final-count",
    sourceUpdatedAt: "2026-09-18T12:00:00Z",
    national: {
      countedDistricts: 100,
      totalDistricts: 100,
      validVotes: 10000,
      otherVotes: 0,
      parties: [
        { code: "0002", votes: 5000, seats: 175 },
        { code: "0001", votes: 5000, seats: 174 },
      ],
    },
  } as unknown as LiveResult;
  assert.ok(evaluateNowcastOutcome(e, "2026-09-13T19:00:00Z", r));
  const probability = {
    simulations: 1000,
    leftWins: 800,
    rightWins: 200,
    unresolved: 0,
  } as NonNullable<typeof e.probability>;
  assert.ok(
    Math.abs(
      evaluateNowcastOutcome({ ...e, probability }, "2026-09-13T19:00:00Z", r)!
        .majorityBrier! - 0.08,
    ) < 1e-10,
  );
  assert.equal(
    evaluateNowcastOutcome(
      {
        ...e,
        probability: { ...probability, rightWins: 100, unresolved: 100 },
      },
      "2026-09-13T19:00:00Z",
      r,
    )!.majorityBrier,
    null,
  );
  assert.equal(evaluateNowcastOutcome(e, "2026-09-19T19:00:00Z", r), null);
  assert.equal(
    evaluateNowcastOutcome(e, "2026-09-13T19:00:00Z", {
      ...r,
      stage: "preliminary",
    }),
    null,
  );
  assert.equal(
    evaluateNowcastOutcome(e, "2026-09-13T19:00:00Z", {
      ...r,
      national: { ...r.national, countedDistricts: 99 },
    }),
    null,
  );
  assert.equal(
    evaluateNowcastOutcome(
      { ...e, status: "insufficient" },
      "2026-09-13T19:00:00Z",
      r,
    ),
    null,
  );
});
