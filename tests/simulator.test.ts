import assert from "node:assert/strict";
import test from "node:test";
import { getSimulatorBaseline, riksdagSimulatorData } from "../lib/simulator/data";
import { coalitionSeats, calculateRiksdagSeats, RIKSDAG_RULES } from "../lib/simulator/riksdag-rules";
import { buildScenarioInput, simulateRiksdagScenario } from "../lib/simulator/scenario";
import {
  SIMULATOR_PARTY_IDS,
  type RiksdagConstituencyInput,
  type SimulatorPartyId,
  type SimulatorPartySeats,
  type SimulatorPartyVotes,
} from "../lib/simulator/types";

function partyRecord(value = 0): SimulatorPartyVotes {
  return Object.fromEntries(SIMULATOR_PARTY_IDS.map((partyId) => [partyId, value])) as SimulatorPartyVotes;
}

function seatRecord(result: ReturnType<typeof calculateRiksdagSeats>, key: "fixedSeats" | "adjustmentSeats" | "totalSeats"): SimulatorPartySeats {
  return Object.fromEntries(result.parties.map((party) => [party.partyId, party[key]])) as SimulatorPartySeats;
}

test("seat-source rules stay synchronized with the executable rules", () => {
  assert.deepEqual(
    {
      version: riksdagSimulatorData.rules.version,
      totalSeats: riksdagSimulatorData.rules.totalSeats,
      fixedSeats: riksdagSimulatorData.rules.fixedSeats,
      adjustmentSeats: riksdagSimulatorData.rules.adjustmentSeats,
      majoritySeats: riksdagSimulatorData.rules.majoritySeats,
      nationalThreshold: riksdagSimulatorData.rules.nationalThreshold,
      constituencyThreshold: riksdagSimulatorData.rules.constituencyThreshold,
      firstDivisor: riksdagSimulatorData.rules.firstDivisor,
    },
    RIKSDAG_RULES,
  );
});

for (const backtest of riksdagSimulatorData.backtests) {
  test(`Riksdag engine exactly reproduces official ${backtest.year} allocation`, () => {
    const result = calculateRiksdagSeats(backtest);
    assert.deepEqual(seatRecord(result, "fixedSeats"), backtest.expected.fixed);
    assert.deepEqual(seatRecord(result, "adjustmentSeats"), backtest.expected.adjustment);
    assert.deepEqual(seatRecord(result, "totalSeats"), backtest.expected.total);
    assert.equal(result.totalSeats, 349);
    assert.equal(result.adjustmentSeats, 39);
    assert.equal(result.tieBreaks.length, 0);
  });
}

test("scenario projection is deterministic and preserves every seat", () => {
  const baseline = getSimulatorBaseline();
  const first = simulateRiksdagScenario(baseline, baseline.shares);
  const second = simulateRiksdagScenario(baseline, baseline.shares);
  assert.deepEqual(first, second);
  assert.equal(first.result.parties.reduce((sum, party) => sum + party.totalSeats, 0), 349);
  assert.deepEqual(seatRecord(first.result, "totalSeats"), baseline.officialSeats2022);
  assert.equal(first.classification, "MODEL");
});

test("the national threshold includes exactly 4.0% and excludes 3.99%", () => {
  const baseline = getSimulatorBaseline();
  const atFour = { ...baseline.shares, L: 4 };
  const belowFour = { ...baseline.shares, L: 3.99 };
  const included = simulateRiksdagScenario(baseline, atFour).result.parties.find((party) => party.partyId === "L");
  const excluded = simulateRiksdagScenario(baseline, belowFour).result.parties.find((party) => party.partyId === "L");
  assert.equal(included?.thresholdStatus, "national");
  assert.ok((included?.totalSeats ?? 0) > 0);
  assert.equal(excluded?.thresholdStatus, "below");
  assert.equal(excluded?.totalSeats, 0);
});

test("a sub-4% party can receive fixed seats through the 12% constituency rule", () => {
  const constituencies: RiksdagConstituencyInput[] = Array.from({ length: 29 }, (_, index) => {
    const partyVotes = partyRecord();
    partyVotes.S = index === 0 ? 40_000 : 50_000;
    partyVotes.M = index === 0 ? 35_000 : 45_000;
    partyVotes.C = index === 0 ? 20_000 : 2_000;
    return {
      code: String(index + 1).padStart(2, "0"),
      name: `Test constituency ${index + 1}`,
      validVotes: 100_000,
      fixedSeats: index < 20 ? 11 : 10,
      partyVotes,
    };
  });
  const result = calculateRiksdagSeats({ nationalValidVotes: 2_900_000, constituencies });
  const center = result.parties.find((party) => party.partyId === "C");
  assert.equal(center?.thresholdStatus, "constituency");
  assert.ok((center?.fixedSeats ?? 0) > 0);
  assert.equal(center?.adjustmentSeats, 0);
  assert.ok(result.localThresholdSeats > 0);
  assert.equal(result.totalSeats, 349);
});

test("invalid shares fail before seat allocation", () => {
  const baseline = getSimulatorBaseline();
  const invalid = partyRecord(13);
  assert.throws(() => buildScenarioInput(baseline, invalid), /cannot exceed 100%/);
});

test("coalition arithmetic uses the neutral user-selected party set", () => {
  const baseline = getSimulatorBaseline();
  const result = simulateRiksdagScenario(baseline, baseline.shares).result;
  const selected: SimulatorPartyId[] = ["S", "V", "MP"];
  const expected = result.parties.filter((party) => selected.includes(party.partyId)).reduce((sum, party) => sum + party.totalSeats, 0);
  assert.equal(coalitionSeats(result, selected), expected);
  assert.equal(result.majoritySeats, 175);
});
