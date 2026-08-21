import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nationalHistory } from "../lib/data/elections/index";
import { dateInTimeZone, isIsoDateStamp, isoDateToEpoch } from "../lib/dates";
import { electionForecast } from "../lib/forecast/data";
import { generateElectionForecast, validateForecastInputs } from "../lib/forecast/model";
import { calculatePollAverage, parsePollCsv, qualifyingPolls } from "../lib/forecast/polls";
import { FORECAST_PARTY_IDS, type PollObservation } from "../lib/forecast/types";
import { calculateRiksdagSeats } from "../lib/simulator/riksdag-rules";
import type { RiksdagConstituencyInput, SimulatorPartyVotes } from "../lib/simulator/types";

const COMPLETE_SHARES: SimulatorPartyVotes = { S: 30, SD: 20, M: 19, V: 8, C: 6, KD: 6, MP: 7, L: 3 };

function poll(overrides: Partial<PollObservation> = {}): PollObservation {
  return {
    publishedMonth: "2022-aug",
    company: "Test",
    house: "Test",
    shares: COMPLETE_SHARES,
    uncertain: null,
    sampleSize: 1_500,
    publishedAt: "2022-08-10",
    fieldworkFrom: "2022-08-01",
    fieldworkTo: "2022-08-07",
    approximateFieldwork: false,
    rowNumber: 2,
    ...overrides,
  };
}

test("calendar dates are strict and cannot normalize impossible days", () => {
  assert.equal(isIsoDateStamp("2026-02-28"), true);
  assert.equal(isIsoDateStamp("2026-02-31"), false);
  assert.throws(() => isoDateToEpoch("2026-02-31"), /Invalid ISO date/);
  assert.equal(dateInTimeZone(new Date("2026-08-22T22:30:00Z"), "Europe/Stockholm"), "2026-08-23");

  const invalidCsv = [
    "PublYearMonth,Company,M,L,C,KD,S,V,MP,SD,FI,Uncertain,n,PublDate,collectPeriodFrom,collectPeriodTo,approxPeriod,house",
    "2026-Feb,Test,19,3,6,4,30,8,6,20,1,3,1500,2026-02-31,2026-02-20,2026-02-25,FALSE,Test",
  ].join("\n");
  assert.throws(() => parsePollCsv(invalidCsv), /Invalid poll date/);
});

test("forecast generation and input validation reject post-election cutoffs", async () => {
  const raw = await readFile("data/raw/polls/SwedishPolls.csv", "utf8");
  const polls = parsePollCsv(raw);
  assert.throws(() => validateForecastInputs(polls, "2026-09-14"), /after election day/);
  assert.throws(() => generateElectionForecast({
    polls,
    history: nationalHistory.elections,
    source: electionForecast.source,
    dataCutoff: "2026-09-14",
    generatedAt: "2026-09-14T12:00:00Z",
    simulations: 2,
    seed: 42,
  }), /after election day/);
});

test("historical cutoffs cannot see polls published later", () => {
  const available = poll({ rowNumber: 2, publishedAt: "2022-08-10" });
  const unpublished = poll({ rowNumber: 3, house: "Future", publishedAt: "2022-08-20", fieldworkFrom: "2022-07-20", fieldworkTo: "2022-07-25" });
  assert.deepEqual(qualifyingPolls([available, unpublished], "2022-08-15", 180).map(({ rowNumber }) => rowNumber), [2]);
});

test("the modern average rejects incomplete party-taxonomy rows instead of imputing zero", () => {
  const incomplete = poll({ rowNumber: 3, shares: { ...COMPLETE_SHARES, SD: undefined } });
  const average = calculatePollAverage([poll(), incomplete], "2022-08-15", { windowDays: 180, halfLifeDays: 28 });
  assert.equal(average.pollCount, 1);
  assert.ok(average.shares.SD > 0);
});

test("poll ordering cannot change the weighted average and no house exceeds its cap", () => {
  const observations = [
    ...Array.from({ length: 12 }, (_, index) => poll({ rowNumber: index + 2, company: "Dominant", house: "Dominant", publishedAt: `2022-08-${String(1 + index).padStart(2, "0")}` })),
    poll({ rowNumber: 20, company: "B", house: "B", shares: { ...COMPLETE_SHARES, S: 32 } }),
    poll({ rowNumber: 21, company: "C", house: "C", shares: { ...COMPLETE_SHARES, S: 28 } }),
    poll({ rowNumber: 22, company: "D", house: "D", shares: { ...COMPLETE_SHARES, S: 31 } }),
  ];
  const first = calculatePollAverage(observations, "2022-08-15", { windowDays: 180, halfLifeDays: 28 });
  const reversed = calculatePollAverage([...observations].reverse(), "2022-08-15", { windowDays: 180, halfLifeDays: 28 });
  assert.deepEqual(first.shares, reversed.shares);
  assert.ok(first.maximumRealizedHouseWeight <= 0.2500001);
});

test("the checked-in forecast is pinned, complete and honest about validation", async () => {
  const [raw, normalized, manifestText] = await Promise.all([
    readFile("data/raw/polls/SwedishPolls.csv", "utf8"),
    readFile("data/normalized/election-forecast-2026.json", "utf8"),
    readFile("data/raw/polls/source-manifest.json", "utf8"),
  ]);
  const manifest = JSON.parse(manifestText) as { rawSha256: string; normalizedForecastSha256: string; expectedRows: number };
  assert.equal(createHash("sha256").update(raw).digest("hex"), manifest.rawSha256);
  assert.equal(createHash("sha256").update(normalized).digest("hex"), manifest.normalizedForecastSha256);
  assert.equal(parsePollCsv(raw).length, manifest.expectedRows);
  assert.equal(electionForecast.model.windowDays, 180);
  assert.equal(electionForecast.model.halfLifeDays, 28);
  assert.equal(electionForecast.model.otherCategorySeatTreatment, "aggregate-assumed-seat-ineligible");
  assert.deepEqual(electionForecast.backtests.map(({ year, role, polls }) => [year, role, polls]), [
    [2010, "calibration", 45],
    [2014, "calibration", 41],
    [2018, "calibration", 43],
    [2022, "holdout", 35],
  ]);
  assert.deepEqual(electionForecast.evidence.excludedCoverageAuditYears, [2002, 2006]);
  assert.equal(Object.values(electionForecast.centralScenario.seats).reduce((sum, seats) => sum + seats, 0), 349);
  assert.ok(electionForecast.questions.every(({ probability }) => probability >= 0 && probability <= 1));
});

test("the forecast is deterministic for the same snapshot, configuration and seed", async () => {
  const raw = await readFile("data/raw/polls/SwedishPolls.csv", "utf8");
  const options = {
    polls: parsePollCsv(raw),
    history: nationalHistory.elections,
    source: electionForecast.source,
    dataCutoff: electionForecast.model.dataCutoff,
    generatedAt: electionForecast.model.generatedAt,
    simulations: 100,
    seed: 42,
  };
  const first = generateElectionForecast(options);
  const second = generateElectionForecast(options);
  assert.deepEqual(first, second);
  assert.equal(first.model.simulations, 100);
  assert.equal(Object.values(first.centralScenario.seats).reduce((sum, seats) => sum + seats, 0), 349);
});

test("seeded quotient ties are reproducible and explicitly audited", () => {
  const constituencies: RiksdagConstituencyInput[] = Array.from({ length: 29 }, (_, index) => ({
    code: String(index + 1).padStart(2, "0"),
    name: `Tie constituency ${index + 1}`,
    validVotes: 100_000,
    fixedSeats: index < 20 ? 11 : 10,
    partyVotes: { S: 50_000, M: 50_000, SD: 0, V: 0, C: 0, KD: 0, MP: 0, L: 0 },
  }));
  const input = { nationalValidVotes: 2_900_000, constituencies };
  const first = calculateRiksdagSeats(input, { tieSeed: 2026 });
  const second = calculateRiksdagSeats(input, { tieSeed: 2026 });
  assert.deepEqual(first, second);
  assert.ok(first.tieBreaks.length > 0);
  assert.match(first.tieBreaks[0], /seeded reproducible drawing of lots/);
  assert.equal(first.parties.reduce((sum, party) => sum + party.totalSeats, 0), 349);
});

test("all eight modeled party identifiers are present once", () => {
  assert.deepEqual(electionForecast.parties.map(({ partyId }) => partyId), [...FORECAST_PARTY_IDS]);
});
