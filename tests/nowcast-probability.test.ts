import test from "node:test";
import assert from "node:assert/strict";
import { majorityProbability } from "../lib/nowcast/probability";
import { publicProbability } from "../lib/nowcast/public";
import type { Projection } from "../lib/nowcast/model";
import {
  NOWCAST_PARTIES,
  type Observation,
  type Votes,
} from "../lib/nowcast/types";
import stress from "../data/normalized/election-nowcast-stress.json";
import seats from "../data/normalized/riksdag-seat-model-inputs.json";
const votes = (s = 0, m = 0, other = 0) =>
  ({
    ...Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0])),
    S: s,
    M: m,
    OTHER: other,
  }) as Votes;
const structure = Object.entries(seats.scenario.fixedSeatsByConstituency).map(
  ([code, fixedSeats]) => ({ code, name: code, fixedSeats }),
);
function sample(counted: Votes, projected: Votes) {
  const projection: Projection = {
    estimate: {
      status: "experimental",
      matchedCoverage: 0.2,
    } as Projection["estimate"],
    constituencyVotes: new Map(structure.map((c) => [c.code, projected])),
  };
  const observations: Observation[] = structure.map((c) => ({
    code: `${c.code}-synthetic`,
    municipality: c.code,
    constituency: c.code,
    eligible: 10000,
    votes: counted,
    reported: true,
    collection: false,
  }));
  return { projection, observations };
}
test("majority simulations cannot overturn a majority already secured by counted votes", () => {
  for (const side of ["left", "right"]) {
    const { projection, observations } = sample(
      side === "left" ? votes(9000, 0) : votes(0, 9000),
      votes(9000, 9000),
    );
    // Only 1,000 votes remain: even extreme model shocks cannot rewrite the 9,000 observed votes.
    projection.constituencyVotes = new Map(
      structure.map((c) => [
        c.code,
        side === "left" ? votes(9000, 1000) : votes(1000, 9000),
      ]),
    );
    const result = majorityProbability(
      projection,
      observations,
      structure,
      stress,
      0,
      100,
    )!;
    assert.equal(result[side === "left" ? "leftWins" : "rightWins"], 100);
    assert.equal(result.unresolved, 0);
    assert.deepEqual(
      observations[0].votes,
      side === "left" ? votes(9000, 0) : votes(0, 9000),
    );
  }
});
test("seeded probability draws reproduce, remain uncertain near a tie, and keep unresolved draws in the denominator", () => {
  const { projection, observations } = sample(
    votes(1000, 1000),
    votes(5000, 5000),
  );
  const start = performance.now();
  const result = majorityProbability(
    projection,
    observations,
    structure,
    stress,
    731,
  )!;
  assert.deepEqual(
    result,
    majorityProbability(projection, observations, structure, stress, 731),
  );
  assert.equal(result.leftWins + result.rightWins + result.unresolved, 1000);
  assert.ok(result.leftWins > 0 && result.rightWins > 0);
  assert.ok(
    performance.now() - start < 60000,
    "Two full probability runs must fit comfortably within the collector timeout",
  );
  const unknown = sample(votes(1000, 1000), votes(3000, 3000, 4000));
  const allUnknown = majorityProbability(
    unknown.projection,
    unknown.observations,
    structure,
    stress,
    731,
    100,
  )!;
  assert.equal(allUnknown.unresolved, 100);
  assert.equal(allUnknown.leftWins + allUnknown.rightWins, 0);
  projection.estimate.probability = result;
  assert.ok(publicProbability(projection.estimate));
  projection.estimate.probability = { ...result, unresolved: 1001 };
  assert.equal(publicProbability(projection.estimate), null);
  projection.estimate.probability = {
    ...result,
    calibration: "validated",
  } as unknown as typeof result;
  assert.equal(publicProbability(projection.estimate), null);
  projection.estimate.status = "insufficient";
  assert.equal(
    majorityProbability(projection, observations, structure, stress, 731),
    undefined,
  );
  projection.estimate.status = "counted";
  assert.equal(
    majorityProbability(projection, observations, structure, stress, 731),
    undefined,
  );
});
test("joint historical errors preserve the party composition instead of sampling parties independently", () => {
  for (const checkpoint of stress.checkpoints) {
    assert.equal(checkpoint.remainingShareErrors.length, 24);
    for (const row of checkpoint.remainingShareErrors) {
      assert.ok(Object.values(row).every(Number.isFinite));
      assert.ok(Math.abs(Object.values(row).reduce((s, n) => s + n, 0)) < 1e-6);
    }
  }
});

test("geographic residuals, model disagreement and turnout stress keep fixed votes and a complete simulation denominator", () => {
  const { projection, observations } = sample(
    votes(1000, 1000),
    votes(5000, 5000),
  );
  projection.estimate.diagnostics = {
    estimator: "regularized-geographic",
    penalty: 25,
    effectiveDistricts: 90,
    municipalities: 30,
    crossValidationMaePp: 1,
    nationalCrossValidationMaePp: 2,
    extrapolatedVoteShare: 0.1,
    modelDisagreementPp: votes(1, -1),
    clusterResidualsPp: Array.from({ length: 30 }, (_, i) =>
      votes(i % 2 ? 2 : -2, i % 2 ? -2 : 2),
    ),
    turnoutResidualRms: 0.06,
  };
  const preserved = structuredClone(observations);
  const p = majorityProbability(
    projection,
    observations,
    structure,
    stress,
    155,
    100,
  )!;
  assert.equal(p.stressScenarios, 24);
  assert.equal(p.localResidualGroups, 30);
  assert.equal(p.turnoutLogSd, 0.06);
  assert.equal(p.leftWins + p.rightWins + p.unresolved, 100);
  assert.deepEqual(observations, preserved);
  assert.deepEqual(
    p,
    majorityProbability(projection, observations, structure, stress, 155, 100),
  );
});
