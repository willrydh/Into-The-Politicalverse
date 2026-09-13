import { calculateRiksdagSeats } from "../simulator/riksdag-rules";
import {
  SIMULATOR_PARTY_IDS,
  type SimulatorPartyVotes,
} from "../simulator/types";
import { insist } from "../live/validation";
import {
  NOWCAST_PARTIES,
  PROBABILITY_VERSION,
  type MajorityProbability,
  type Observation,
  type StressReport,
  type Votes,
} from "./types";
import type { Projection } from "./model";
import { roundedVotes } from "./votes";

const zero = () =>
  Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0])) as Votes;
const total = (v: Votes) => NOWCAST_PARTIES.reduce((s, p) => s + v[p], 0);

/** Conditional simulation frequency, NOT an empirically calibrated win probability. */
export function majorityProbability(
  projection: Projection,
  observations: Observation[],
  structure: { code: string; name: string; fixedSeats: number }[],
  stress: StressReport,
  seed: number,
  simulations = 1000,
): MajorityProbability | undefined {
  if (projection.estimate.status !== "experimental") return undefined;
  insist(
    Number.isInteger(simulations) && simulations >= 100 && simulations <= 1000,
    "Invalid probability simulation count",
  );
  const checkpoint =
    stress.checkpoints
      .filter((c) => c.coverage <= projection.estimate.matchedCoverage)
      .at(-1) ?? stress.checkpoints[0];
  const errors = checkpoint.remainingShareErrors;
  insist(
    errors.length === 6 &&
      errors.every((v) => NOWCAST_PARTIES.every((p) => Number.isFinite(v[p]))),
    "Missing joint historical stress errors",
  );
  const counted = new Map<string, Votes>();
  for (const o of observations.filter((o) => o.reported)) {
    const v = counted.get(o.constituency) ?? zero();
    for (const p of NOWCAST_PARTIES) v[p] += o.votes[p];
    counted.set(o.constituency, v);
  }
  const areas = structure.map((c) => {
    const observed = counted.get(c.code) ?? zero();
    const projected = projection.constituencyVotes.get(c.code);
    insist(projected, "Missing projected constituency");
    const remaining = zero();
    for (const p of NOWCAST_PARTIES) {
      insist(projected[p] >= observed[p], "Projection lost counted votes");
      remaining[p] = projected[p] - observed[p];
    }
    return { ...c, observed, remaining, volume: total(remaining) };
  });
  const result: MajorityProbability = {
    methodVersion: PROBABILITY_VERSION,
    calibration: "unvalidated",
    definition: "175-of-349",
    simulations,
    seed: seed >>> 0,
    noiseFloorPp: 1,
    leftWins: 0,
    rightWins: 0,
    unresolved: 0,
  };
  // Xorshift32 and Box–Muller; identical source bytes produce identical draws.
  let state = seed >>> 0 || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) + 0.5) / 4294967296;
  };
  const normal = () =>
    Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
  for (let draw = 0; draw < simulations; draw++) {
    // Uncentred second moment retains historical bias as uncertainty. Gaussian
    // transport and the 1 pp remaining-vote noise floor are explicit assumptions.
    const coefficients = errors.map(() => normal() / Math.sqrt(errors.length));
    const shock = zero();
    for (const p of NOWCAST_PARTIES)
      shock[p] =
        (errors.reduce((s, e, i) => s + e[p] * coefficients[i], 0) +
          normal() * result.noiseFloorPp) /
        100;
    const mean = total(shock) / NOWCAST_PARTIES.length;
    for (const p of NOWCAST_PARTIES) shock[p] -= mean;
    const constituencies = areas.map((c) => {
      const shifted = zero();
      for (const p of NOWCAST_PARTIES)
        shifted[p] = Math.max(
          0,
          (c.volume ? c.remaining[p] / c.volume : 0) + shock[p],
        );
      const denominator = total(shifted);
      const votes = zero();
      for (const p of NOWCAST_PARTIES)
        votes[p] =
          c.observed[p] +
          (c.volume ? (shifted[p] / denominator) * c.volume : 0);
      const rounded = roundedVotes(votes);
      return {
        code: c.code,
        name: c.name,
        fixedSeats: c.fixedSeats,
        validVotes: total(rounded),
        partyVotes: Object.fromEntries(
          SIMULATOR_PARTY_IDS.map((p) => [p, rounded[p]]),
        ) as SimulatorPartyVotes,
        other: rounded.OTHER,
      };
    });
    const nationalValidVotes = constituencies.reduce(
      (s, c) => s + c.validVotes,
      0,
    );
    // Keep unresolved simulations in the denominator: never condition silently
    // on OTHER failing to cross a threshold the eight-party engine cannot model.
    if (
      constituencies.some(
        (c) => c.validVotes === 0 || c.other / c.validVotes >= 0.12,
      ) ||
      constituencies.reduce((s, c) => s + c.other, 0) / nationalValidVotes >=
        0.04
    ) {
      result.unresolved++;
      continue;
    }
    const allocation = calculateRiksdagSeats(
      { nationalValidVotes, constituencies },
      { tieSeed: (seed + draw + 1) >>> 0 || 1 },
    );
    const left = allocation.parties
      .filter((p) => ["S", "V", "MP", "C"].includes(p.partyId))
      .reduce((s, p) => s + p.totalSeats, 0);
    const right = allocation.parties
      .filter((p) => ["M", "KD", "SD", "L"].includes(p.partyId))
      .reduce((s, p) => s + p.totalSeats, 0);
    insist(left + right === 349, "Probability allocation lost mandates");
    if (left >= 175) result.leftWins++;
    else if (right >= 175) result.rightWins++;
    else result.unresolved++;
  }
  return result;
}
