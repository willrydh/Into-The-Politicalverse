import {
  SIMULATOR_PARTY_IDS,
  type PartySeatAllocation,
  type RiksdagConstituencyInput,
  type RiksdagElectionInput,
  type RiksdagSeatResult,
  type SeatAward,
  type SimulatorPartyId,
  type SimulatorPartySeats,
  type SimulatorPartyVotes,
  type ThresholdStatus,
} from "./types";

export const RIKSDAG_RULES = {
  version: "riksdag-2026-v1.0.0",
  totalSeats: 349,
  fixedSeats: 310,
  adjustmentSeats: 39,
  majoritySeats: 175,
  nationalThreshold: 0.04,
  constituencyThreshold: 0.12,
  firstDivisor: 1.2,
} as const;

type Candidate = {
  partyId: SimulatorPartyId;
  constituencyCode?: string;
  votes: number;
  divisorTenths: number;
  stableIndex: number;
};

type InternalAward = SeatAward & {
  votes: number;
  divisorTenths: number;
  active: boolean;
};

function emptySeats(): SimulatorPartySeats {
  return Object.fromEntries(SIMULATOR_PARTY_IDS.map((partyId) => [partyId, 0])) as SimulatorPartySeats;
}

function emptyVotes(): SimulatorPartyVotes {
  return Object.fromEntries(SIMULATOR_PARTY_IDS.map((partyId) => [partyId, 0])) as SimulatorPartyVotes;
}

function modifiedDivisorTenths(seats: number): number {
  return seats === 0 ? 12 : (seats * 2 + 1) * 10;
}

function compareQuotients(left: Candidate, right: Candidate): number {
  const leftCross = left.votes * right.divisorTenths;
  const rightCross = right.votes * left.divisorTenths;
  if (leftCross !== rightCross) return leftCross > rightCross ? -1 : 1;
  return left.stableIndex - right.stableIndex;
}

function sameQuotient(left: Candidate, right: Candidate): boolean {
  return left.votes * right.divisorTenths === right.votes * left.divisorTenths;
}

function chooseCandidate(candidates: Candidate[], context: string, tieBreaks: string[]): Candidate {
  if (candidates.length === 0) throw new Error(`No eligible party for ${context}`);
  const ranked = [...candidates].sort(compareQuotients);
  if (ranked[1] && sameQuotient(ranked[0], ranked[1])) {
    tieBreaks.push(`${context}: ${ranked[0].partyId} and ${ranked[1].partyId} had equal comparison figures; stable registry order replaced the official drawing of lots.`);
  }
  return ranked[0];
}

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
}

function validateInput(input: RiksdagElectionInput): void {
  assertInteger(input.nationalValidVotes, "National valid votes");
  if (input.nationalValidVotes === 0) throw new Error("National valid votes must be greater than zero");
  if (input.constituencies.length !== 29) throw new Error(`Expected 29 Riksdag constituencies, received ${input.constituencies.length}`);

  const codes = new Set<string>();
  let validVoteSum = 0;
  let fixedSeatSum = 0;

  for (const constituency of input.constituencies) {
    if (codes.has(constituency.code)) throw new Error(`Duplicate constituency code ${constituency.code}`);
    codes.add(constituency.code);
    assertInteger(constituency.validVotes, `${constituency.name} valid votes`);
    assertInteger(constituency.fixedSeats, `${constituency.name} fixed seats`);
    const modeledVotes = SIMULATOR_PARTY_IDS.reduce((sum, partyId) => {
      assertInteger(constituency.partyVotes[partyId], `${constituency.name} ${partyId} votes`);
      return sum + constituency.partyVotes[partyId];
    }, 0);
    if (modeledVotes > constituency.validVotes) throw new Error(`${constituency.name} modeled party votes exceed valid votes`);
    validVoteSum += constituency.validVotes;
    fixedSeatSum += constituency.fixedSeats;
  }

  if (validVoteSum !== input.nationalValidVotes) throw new Error(`Constituency valid votes sum to ${validVoteSum}; expected ${input.nationalValidVotes}`);
  if (fixedSeatSum !== RIKSDAG_RULES.fixedSeats) throw new Error(`Fixed seats sum to ${fixedSeatSum}; expected ${RIKSDAG_RULES.fixedSeats}`);
}

function sumNationalVotes(constituencies: RiksdagConstituencyInput[]): SimulatorPartyVotes {
  const votes = emptyVotes();
  for (const constituency of constituencies) {
    for (const partyId of SIMULATOR_PARTY_IDS) votes[partyId] += constituency.partyVotes[partyId];
  }
  return votes;
}

function thresholdStatuses(input: RiksdagElectionInput, nationalVotes: SimulatorPartyVotes): Record<SimulatorPartyId, ThresholdStatus> {
  return Object.fromEntries(SIMULATOR_PARTY_IDS.map((partyId) => {
    if (nationalVotes[partyId] / input.nationalValidVotes >= RIKSDAG_RULES.nationalThreshold) return [partyId, "national"];
    const reachesConstituencyThreshold = input.constituencies.some(
      (constituency) => constituency.validVotes > 0 && constituency.partyVotes[partyId] / constituency.validVotes >= RIKSDAG_RULES.constituencyThreshold,
    );
    return [partyId, reachesConstituencyThreshold ? "constituency" : "below"];
  })) as Record<SimulatorPartyId, ThresholdStatus>;
}

function awardToPublic(award: InternalAward): SeatAward {
  return {
    kind: award.kind,
    constituencyCode: award.constituencyCode,
    constituencyName: award.constituencyName,
    partyId: award.partyId,
    divisor: award.divisor,
    quotient: award.quotient,
  };
}

export function calculateRiksdagSeats(input: RiksdagElectionInput): RiksdagSeatResult {
  validateInput(input);
  const tieBreaks: string[] = [];
  const nationalVotes = sumNationalVotes(input.constituencies);
  const statuses = thresholdStatuses(input, nationalVotes);
  const constituencyByCode = new Map(input.constituencies.map((constituency) => [constituency.code, constituency]));
  const partyStableIndex = new Map(SIMULATOR_PARTY_IDS.map((partyId, index) => [partyId, index]));
  const constituencyStableIndex = new Map(input.constituencies.map((constituency, index) => [constituency.code, index]));
  const fixedAwards: InternalAward[] = [];
  const fixedByConstituency = new Map<string, SimulatorPartySeats>();

  for (const constituency of input.constituencies) {
    const localSeats = emptySeats();
    fixedByConstituency.set(constituency.code, localSeats);

    for (let seatIndex = 0; seatIndex < constituency.fixedSeats; seatIndex += 1) {
      const candidates = SIMULATOR_PARTY_IDS
        .filter((partyId) => statuses[partyId] === "national" || constituency.partyVotes[partyId] / constituency.validVotes >= RIKSDAG_RULES.constituencyThreshold)
        .map((partyId) => ({
          partyId,
          constituencyCode: constituency.code,
          votes: constituency.partyVotes[partyId],
          divisorTenths: modifiedDivisorTenths(localSeats[partyId]),
          stableIndex: partyStableIndex.get(partyId) ?? 0,
        }));
      const winner = chooseCandidate(candidates, `${constituency.name} fixed seat ${seatIndex + 1}`, tieBreaks);
      const divisor = winner.divisorTenths / 10;
      localSeats[winner.partyId] += 1;
      fixedAwards.push({
        kind: "fixed",
        constituencyCode: constituency.code,
        constituencyName: constituency.name,
        partyId: winner.partyId,
        divisor,
        quotient: winner.votes / divisor,
        votes: winner.votes,
        divisorTenths: winner.divisorTenths,
        active: true,
      });
    }
  }

  const initialFixedTotals = emptySeats();
  for (const award of fixedAwards) initialFixedTotals[award.partyId] += 1;
  const localThresholdSeats = SIMULATOR_PARTY_IDS
    .filter((partyId) => statuses[partyId] === "constituency")
    .reduce((sum, partyId) => sum + initialFixedTotals[partyId], 0);
  const nationallyAllocatedSeatCount = RIKSDAG_RULES.totalSeats - localThresholdSeats;
  const nationalTargets = emptySeats();

  for (let seatIndex = 0; seatIndex < nationallyAllocatedSeatCount; seatIndex += 1) {
    const candidates = SIMULATOR_PARTY_IDS
      .filter((partyId) => statuses[partyId] === "national")
      .map((partyId) => ({
        partyId,
        votes: nationalVotes[partyId],
        divisorTenths: modifiedDivisorTenths(nationalTargets[partyId]),
        stableIndex: partyStableIndex.get(partyId) ?? 0,
      }));
    const winner = chooseCandidate(candidates, `national total seat ${seatIndex + 1}`, tieBreaks);
    nationalTargets[winner.partyId] += 1;
  }

  const returnedSlots: { constituencyCode: string; sourcePartyId: SimulatorPartyId }[] = [];
  for (const partyId of SIMULATOR_PARTY_IDS) {
    const excess = statuses[partyId] === "national" ? Math.max(0, initialFixedTotals[partyId] - nationalTargets[partyId]) : 0;
    if (excess === 0) continue;
    const returnableAwards = fixedAwards
      .filter((award) => award.partyId === partyId && (constituencyByCode.get(award.constituencyCode)?.fixedSeats ?? 0) >= 3)
      .sort((left, right) => {
        const comparison = compareQuotients(
          { partyId: left.partyId, votes: left.votes, divisorTenths: left.divisorTenths, stableIndex: constituencyStableIndex.get(left.constituencyCode) ?? 0 },
          { partyId: right.partyId, votes: right.votes, divisorTenths: right.divisorTenths, stableIndex: constituencyStableIndex.get(right.constituencyCode) ?? 0 },
        );
        return -comparison;
      });
    if (returnableAwards.length < excess) {
      throw new Error(`${partyId} has ${excess} excess fixed seats but only ${returnableAwards.length} can be returned under the three-seat constituency rule`);
    }
    for (const award of returnableAwards.slice(0, excess)) {
      award.active = false;
      returnedSlots.push({ constituencyCode: award.constituencyCode, sourcePartyId: partyId });
    }
  }

  const currentFixedTotals = emptySeats();
  for (const partySeats of fixedByConstituency.values()) {
    for (const partyId of SIMULATOR_PARTY_IDS) partySeats[partyId] = 0;
  }
  for (const award of fixedAwards.filter((award) => award.active)) {
    currentFixedTotals[award.partyId] += 1;
    const local = fixedByConstituency.get(award.constituencyCode);
    if (local) local[award.partyId] += 1;
  }

  const reallocatedAwards: InternalAward[] = [];
  while (returnedSlots.length > 0) {
    const candidates = returnedSlots.flatMap((slot, slotIndex) => {
      const constituency = constituencyByCode.get(slot.constituencyCode);
      const localSeats = fixedByConstituency.get(slot.constituencyCode);
      if (!constituency || !localSeats) return [];
      return SIMULATOR_PARTY_IDS
        .filter((partyId) => partyId !== slot.sourcePartyId && statuses[partyId] === "national" && currentFixedTotals[partyId] < nationalTargets[partyId])
        .map((partyId) => ({
          partyId,
          constituencyCode: slot.constituencyCode,
          votes: constituency.partyVotes[partyId],
          divisorTenths: modifiedDivisorTenths(localSeats[partyId]),
          stableIndex: slotIndex * SIMULATOR_PARTY_IDS.length + (partyStableIndex.get(partyId) ?? 0),
        }));
    });
    const winner = chooseCandidate(candidates, `returned fixed seat ${reallocatedAwards.length + 1}`, tieBreaks);
    const slotIndex = returnedSlots.findIndex((slot) => slot.constituencyCode === winner.constituencyCode);
    const slot = returnedSlots.splice(slotIndex, 1)[0];
    const constituency = constituencyByCode.get(slot.constituencyCode);
    const localSeats = fixedByConstituency.get(slot.constituencyCode);
    if (!constituency || !localSeats) throw new Error(`Missing constituency ${slot.constituencyCode} during fixed-seat reallocation`);
    const divisor = winner.divisorTenths / 10;
    localSeats[winner.partyId] += 1;
    currentFixedTotals[winner.partyId] += 1;
    reallocatedAwards.push({
      kind: "reallocated-fixed",
      constituencyCode: constituency.code,
      constituencyName: constituency.name,
      partyId: winner.partyId,
      divisor,
      quotient: winner.votes / divisor,
      votes: winner.votes,
      divisorTenths: winner.divisorTenths,
      active: true,
    });
  }

  const adjustmentAwards: InternalAward[] = [];
  const adjustmentTotals = emptySeats();
  for (const partyId of SIMULATOR_PARTY_IDS) {
    const needed = statuses[partyId] === "national" ? nationalTargets[partyId] - currentFixedTotals[partyId] : 0;
    if (needed < 0) throw new Error(`${partyId} remains overrepresented after fixed-seat return`);
    for (let seatIndex = 0; seatIndex < needed; seatIndex += 1) {
      const candidates = input.constituencies.map((constituency, index) => {
        const fixedSeats = fixedByConstituency.get(constituency.code)?.[partyId] ?? 0;
        const priorAdjustmentSeats = adjustmentAwards.filter(
          (award) => award.partyId === partyId && award.constituencyCode === constituency.code,
        ).length;
        const currentSeats = fixedSeats + priorAdjustmentSeats;
        return {
          partyId,
          constituencyCode: constituency.code,
          votes: constituency.partyVotes[partyId],
          divisorTenths: currentSeats === 0 ? 10 : (currentSeats * 2 + 1) * 10,
          stableIndex: index,
        };
      });
      const winner = chooseCandidate(candidates, `${partyId} adjustment seat ${seatIndex + 1}`, tieBreaks);
      const constituency = constituencyByCode.get(winner.constituencyCode ?? "");
      if (!constituency) throw new Error(`Missing constituency ${winner.constituencyCode} during adjustment-seat allocation`);
      const divisor = winner.divisorTenths / 10;
      adjustmentTotals[partyId] += 1;
      adjustmentAwards.push({
        kind: "adjustment",
        constituencyCode: constituency.code,
        constituencyName: constituency.name,
        partyId,
        divisor,
        quotient: winner.votes / divisor,
        votes: winner.votes,
        divisorTenths: winner.divisorTenths,
        active: true,
      });
    }
  }

  const allocatedAdjustmentSeats = SIMULATOR_PARTY_IDS.reduce((sum, partyId) => sum + adjustmentTotals[partyId], 0);
  if (allocatedAdjustmentSeats !== RIKSDAG_RULES.adjustmentSeats) {
    throw new Error(`Allocated ${allocatedAdjustmentSeats} adjustment seats; expected ${RIKSDAG_RULES.adjustmentSeats}`);
  }

  const parties: PartySeatAllocation[] = SIMULATOR_PARTY_IDS.map((partyId) => ({
    partyId,
    votes: nationalVotes[partyId],
    share: (nationalVotes[partyId] / input.nationalValidVotes) * 100,
    thresholdStatus: statuses[partyId],
    fixedSeats: currentFixedTotals[partyId],
    adjustmentSeats: adjustmentTotals[partyId],
    totalSeats: currentFixedTotals[partyId] + adjustmentTotals[partyId],
  }));
  const totalAllocated = parties.reduce((sum, party) => sum + party.totalSeats, 0);
  if (totalAllocated !== RIKSDAG_RULES.totalSeats) throw new Error(`Allocated ${totalAllocated} seats; expected ${RIKSDAG_RULES.totalSeats}`);

  return {
    rulesVersion: RIKSDAG_RULES.version,
    totalSeats: totalAllocated,
    fixedSeats: RIKSDAG_RULES.fixedSeats,
    adjustmentSeats: allocatedAdjustmentSeats,
    majoritySeats: RIKSDAG_RULES.majoritySeats,
    returnedFixedSeats: reallocatedAwards.length,
    localThresholdSeats,
    tieBreaks,
    parties,
    awards: [
      ...fixedAwards.filter((award) => award.active).map(awardToPublic),
      ...reallocatedAwards.map(awardToPublic),
      ...adjustmentAwards.map(awardToPublic),
    ],
  };
}

export function coalitionSeats(result: RiksdagSeatResult, partyIds: Iterable<SimulatorPartyId>): number {
  const selected = new Set(partyIds);
  return result.parties.filter((party) => selected.has(party.partyId)).reduce((sum, party) => sum + party.totalSeats, 0);
}
