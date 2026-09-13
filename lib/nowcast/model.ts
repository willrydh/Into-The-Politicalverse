import {
  NOWCAST_PARTIES,
  NOWCAST_VERSION,
  type BaselineUnit,
  type Observation,
  type Votes,
  type NowcastEstimate,
  type StressReport,
} from "./types";
import { insist } from "../live/validation";
const zero = (): Votes =>
  Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0])) as Votes;
const total = (v: Votes) => NOWCAST_PARTIES.reduce((s, p) => s + v[p], 0);
const shares = (v: Votes) => {
  const n = total(v);
  return Object.fromEntries(
    NOWCAST_PARTIES.map((p) => [p, n ? v[p] / n : 0]),
  ) as Votes;
};
const clip = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export type Projection = {
  estimate: NowcastEstimate;
  constituencyVotes: Map<string, Votes>;
};

/** Matched-district swing: observed ballots stay fixed; only unreported units are estimated. */
export function projectVotes(
  units: BaselineUnit[],
  observations: Observation[],
  stress?: StressReport,
): Projection {
  const physical = new Map(
    units.filter((d) => !d.collection).map((d) => [d.code, d]),
  );
  const obs = new Map(observations.map((d) => [d.code, d]));
  insist(obs.size === observations.length, "Duplicate observation");
  for (const o of observations) {
    insist(
      NOWCAST_PARTIES.every(
        (p) => Number.isSafeInteger(o.votes[p]) && o.votes[p] >= 0,
      ),
      "Invalid observed votes",
    );
    insist(o.reported || total(o.votes) === 0, "Unreported district has votes");
  }
  const matched = observations.filter(
    (o) =>
      o.reported &&
      !o.collection &&
      physical.get(o.code)?.matched &&
      total(o.votes) > 0 &&
      o.eligible! > 0,
  );
  const delta = zero(),
    cluster = new Map<string, { weight: number; delta: Votes }>();
  let weight = 0,
    expectedMatchedVotes = 0;
  for (const o of matched) {
    const b = physical.get(o.code)!;
    const n = total(o.votes),
      s = shares(o.votes),
      prior = shares(b.votes);
    weight += n;
    expectedMatchedVotes += (total(b.votes) * o.eligible!) / b.baselineEligible;
    const c = cluster.get(o.municipality) ?? { weight: 0, delta: zero() };
    c.weight += n;
    for (const p of NOWCAST_PARTIES) {
      const diff = s[p] - prior[p];
      delta[p] += n * diff;
      c.delta[p] += n * diff;
    }
    cluster.set(o.municipality, c);
  }
  if (weight) for (const p of NOWCAST_PARTIES) delta[p] /= weight;
  const turnoutRatio = expectedMatchedVotes
    ? clip(weight / expectedMatchedVotes, 0.5, 1.5)
    : 1;
  const matchedUniverse = units
    .filter((d) => d.matched && !d.collection)
    .reduce(
      (s, b) =>
        s +
        (total(b.votes) * (obs.get(b.code)?.eligible ?? b.eligible)) /
          b.baselineEligible,
      0,
    );
  const coverage = matchedUniverse ? expectedMatchedVotes / matchedUniverse : 0;
  const represented = new Set(matched.map((d) => d.constituency)).size;
  const counted = zero(),
    predicted = zero(),
    constituencyVotes = new Map<string, Votes>();
  let remaining = 0,
    collectionRemaining = 0,
    imputed = 0;
  const add = (votes: Votes, krets: string, observed: boolean) => {
    const c = constituencyVotes.get(krets) ?? zero();
    for (const p of NOWCAST_PARTIES) {
      predicted[p] += votes[p];
      c[p] += votes[p];
      if (observed) counted[p] += votes[p];
    }
    constituencyVotes.set(krets, c);
  };
  const estimate = (b: BaselineUnit, volume: number) => {
    const prior = shares(b.votes);
    const shifted = Object.fromEntries(
      NOWCAST_PARTIES.map((p) => [p, Math.max(0, prior[p] + delta[p])]),
    ) as Votes;
    const s = shares(shifted);
    const votes = Object.fromEntries(
      NOWCAST_PARTIES.map((p) => [p, s[p] * volume]),
    ) as Votes;
    add(votes, b.constituency, false);
    remaining += volume;
    if (b.collection) collectionRemaining += volume;
    else if (!b.matched) imputed += volume;
  };
  for (const b of units.filter((b) => !b.collection)) {
    const o = obs.get(b.code);
    if (o?.reported) add(o.votes, o.constituency, true);
    else {
      const eligible = o?.eligible ?? b.eligible;
      estimate(
        b,
        Math.min(
          eligible,
          ((total(b.votes) * eligible) / b.baselineEligible) * turnoutRatio,
        ),
      );
    }
  }
  for (const b of units.filter((b) => b.collection)) {
    const collection = observations.filter(
      (o) => o.collection && o.municipality === b.municipality,
    );
    for (const o of collection.filter((o) => o.reported))
      add(o.votes, o.constituency, true);
    const remainingFraction = collection.length
      ? collection.filter((o) => !o.reported).length / collection.length
      : 1;
    estimate(b, total(b.votes) * turnoutRatio * remainingFraction);
  }
  // Unknown geography must never disappear into a national percentage.
  insist(
    observations.every((o) =>
      o.collection
        ? units.some(
            (b) =>
              b.collection &&
              b.municipality === o.municipality &&
              b.constituency === o.constituency,
          )
        : physical.has(o.code),
    ),
    "Unmapped observation",
  );
  const n = total(predicted),
    countedTotal = total(counted),
    share = shares(predicted),
    countedShare = shares(counted);
  insist(n > 0, "No projection denominator");
  const remainder = remaining / n;
  // Conservative sensitivity envelope, not a confidence interval. Historical
  // stress orders are not real reporting order; municipal clustering does not
  // eliminate non-random reporting bias. Retain a floor for this model risk.
  const checkpoint =
    stress?.checkpoints.filter((c) => c.coverage <= coverage).at(-1) ??
    stress?.checkpoints[0];
  const rows = NOWCAST_PARTIES.map((p) => {
    const variance = [...cluster.values()].reduce(
      (s, c) => s + (c.delta[p] - c.weight * delta[p]) ** 2,
      0,
    );
    const se =
      weight && cluster.size > 1
        ? Math.sqrt((variance * cluster.size) / (cluster.size - 1)) / weight
        : 1;
    const historyError = checkpoint?.maxPartyError[p] ?? 3;
    const envelope =
      remaining > 0
        ? Math.max(
            historyError,
            2 * se * 100 * remainder,
            1 * remainder + imputed / n + (collectionRemaining / n) * 2,
          )
        : 0;
    return {
      partyId: p,
      countedVotes: counted[p],
      countedShare: countedTotal ? countedShare[p] * 100 : null,
      projectedVotes: predicted[p],
      projectedShare: share[p] * 100,
      sensitivity: [
        clip(share[p] * 100 - envelope, 0, 100),
        clip(share[p] * 100 + envelope, 0, 100),
      ] as [number, number],
      seats: null,
    };
  });
  const ready =
    matched.length >= 100 &&
    represented >= 8 &&
    coverage >= 0.05 &&
    matched.length /
      Math.max(
        1,
        observations.filter((d) => d.reported && !d.collection).length,
      ) >=
      0.7;
  return {
    constituencyVotes,
    estimate: {
      classification: "MODEL",
      methodVersion: NOWCAST_VERSION,
      baselineYear: 2022,
      status:
        remaining === 0 ? "counted" : ready ? "experimental" : "insufficient",
      matchedDistricts: matched.length,
      representedConstituencies: represented,
      matchedCoverage: coverage,
      countedDistricts: observations.filter((o) => o.reported).length,
      totalDistricts: observations.length,
      countedVotes: countedTotal,
      estimatedRemainingVotes: remaining,
      estimatedCollectionVotes: collectionRemaining,
      imputedRemainingVoteShare: imputed / n,
      rows,
    },
  };
}
