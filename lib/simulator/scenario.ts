import { calculateRiksdagSeats } from "./riksdag-rules";
import {
  SIMULATOR_PARTY_IDS,
  type RiksdagElectionInput,
  type RiksdagSeatResult,
  type SimulatorPartyId,
  type SimulatorPartyVotes,
} from "./types";
import type { SimulatorBaseline } from "./data";

export const SCENARIO_VOTE_SCALE = 10_000_000;

type VoteBucket = SimulatorPartyId | "OTHER";

export type ScenarioOutput = {
  classification: "MODEL";
  modelId: "pv-riksdag-scenario";
  modelVersion: "1.0.0";
  otherShare: number;
  input: RiksdagElectionInput;
  result: RiksdagSeatResult;
};

function allocateLargestRemainder(total: number, weights: number[], stableKeys: string[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) throw new Error("Allocation weights must sum to more than zero");
  const raw = weights.map((weight) => (weight / weightSum) * total);
  const allocations = raw.map(Math.floor);
  let remainder = total - allocations.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - allocations[index], key: stableKeys[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.key.localeCompare(right.key));
  for (let index = 0; index < remainder; index += 1) allocations[order[index].index] += 1;
  remainder = total - allocations.reduce((sum, value) => sum + value, 0);
  if (remainder !== 0) throw new Error("Largest-remainder allocation did not preserve its total");
  return allocations;
}

function validateShares(shares: SimulatorPartyVotes): number {
  let total = 0;
  for (const partyId of SIMULATOR_PARTY_IDS) {
    const share = shares[partyId];
    if (!Number.isFinite(share) || share < 0 || share > 100) throw new Error(`${partyId} share must be between 0 and 100`);
    total += share;
  }
  if (total > 100 + 1e-9) throw new Error(`Modeled party shares total ${total.toFixed(2)}%; they cannot exceed 100%`);
  return total;
}

export function buildScenarioInput(baseline: SimulatorBaseline, shares: SimulatorPartyVotes): { input: RiksdagElectionInput; otherShare: number } {
  const modeledShare = validateShares(shares);
  const otherShare = Math.max(0, 100 - modeledShare);
  const buckets: VoteBucket[] = [...SIMULATOR_PARTY_IDS, "OTHER"];
  const nationalAllocations = allocateLargestRemainder(
    SCENARIO_VOTE_SCALE,
    [...SIMULATOR_PARTY_IDS.map((partyId) => shares[partyId]), otherShare],
    buckets,
  );
  const constituencyKeys = baseline.constituencies.map((constituency) => constituency.code);
  const projected = baseline.constituencies.map((constituency) => ({
    code: constituency.code,
    name: constituency.name,
    validVotes: 0,
    fixedSeats: constituency.fixedSeats,
    partyVotes: Object.fromEntries(SIMULATOR_PARTY_IDS.map((partyId) => [partyId, 0])) as SimulatorPartyVotes,
  }));

  buckets.forEach((bucket, bucketIndex) => {
    const baselineWeights = baseline.constituencies.map((constituency) => {
      if (bucket !== "OTHER") return constituency.partyVotes[bucket];
      const modeledVotes = SIMULATOR_PARTY_IDS.reduce((sum, partyId) => sum + constituency.partyVotes[partyId], 0);
      return constituency.validVotes - modeledVotes;
    });
    const fallbackWeights = baseline.constituencies.map((constituency) => constituency.validVotes);
    const weights = baselineWeights.reduce((sum, value) => sum + value, 0) > 0 ? baselineWeights : fallbackWeights;
    const allocations = allocateLargestRemainder(nationalAllocations[bucketIndex], weights, constituencyKeys);
    allocations.forEach((votes, constituencyIndex) => {
      projected[constituencyIndex].validVotes += votes;
      if (bucket !== "OTHER") projected[constituencyIndex].partyVotes[bucket] = votes;
    });
  });

  return { input: { nationalValidVotes: SCENARIO_VOTE_SCALE, constituencies: projected }, otherShare };
}

export function simulateRiksdagScenario(
  baseline: SimulatorBaseline,
  shares: SimulatorPartyVotes,
  options: { tieSeed?: number } = {},
): ScenarioOutput {
  const { input, otherShare } = buildScenarioInput(baseline, shares);
  return {
    classification: "MODEL",
    modelId: "pv-riksdag-scenario",
    modelVersion: "1.0.0",
    otherShare,
    input,
    result: calculateRiksdagSeats(input, options),
  };
}
