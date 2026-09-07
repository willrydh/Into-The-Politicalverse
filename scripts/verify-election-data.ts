import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PARTY_IDS, type MunicipalityHistoryData, type NationalHistoryData, type NormalizedRiksdagData } from "../lib/data/elections/types";
import { calculateRiksdagSeats, RIKSDAG_RULES } from "../lib/simulator/riksdag-rules";
import { SIMULATOR_PARTY_IDS, type RiksdagSimulatorData } from "../lib/simulator/types";
import { validateForecastInputs } from "../lib/forecast/model";
import { daysBetween, parsePollCsv, qualifyingPolls, subtractDays } from "../lib/forecast/polls";
import { POLLS_ADAPTER_VERSION, PUBLICATION_DATE_CORRECTIONS } from "../lib/forecast/source-corrections";
import type { ElectionForecast } from "../lib/forecast/types";
import { verifyLocalData } from "../lib/data/geography/verify-local";
import { electionArchive, validateElectionArchive } from "../lib/elections/outcomes";
import { buildSearchIndex } from "../lib/search/build";

import { getCandidateData } from "../lib/candidates/build";

getCandidateData();
const ROOT = resolve(import.meta.dirname, "..");
await verifyLocalData(ROOT);
validateElectionArchive(electionArchive);
buildSearchIndex();
const localityManifest = JSON.parse(await readFile(resolve(ROOT, "data/raw/scb/localities-source-manifest.json"), "utf8"));
if (createHash("sha256").update(await readFile(resolve(ROOT, "data/normalized/scb-localities-2023.json"))).digest("hex") !== localityManifest.normalizedSha256) throw new Error("SCB locality output checksum mismatch");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const election = JSON.parse(await readFile(resolve(ROOT, "data/normalized/riksdag-2022.json"), "utf8")) as NormalizedRiksdagData;
const history = JSON.parse(await readFile(resolve(ROOT, "data/normalized/riksdag-national-history.json"), "utf8")) as NationalHistoryData;
const municipalityHistoryContents = await readFile(resolve(ROOT, "data/normalized/riksdag-municipalities-2018.json"));
const municipalityHistory = JSON.parse(municipalityHistoryContents.toString("utf8")) as MunicipalityHistoryData;
const municipalityHistoryManifest = JSON.parse(await readFile(resolve(ROOT, "data/raw/valmyndigheten/municipality-history-source-manifest.json"), "utf8")) as {
  normalizedSha256: string;
  election2018: { sha256: string };
  expected2018: { municipalities: number; validVotes: number; totalVotes: number; eligibleVoters: number };
};
const geographyContents = await readFile(resolve(ROOT, "data/normalized/municipality-boundaries-2022.geojson"));
const geography = JSON.parse(geographyContents.toString("utf8")) as {
  schemaVersion: number;
  source: { publisher: string; classification: string };
  features: Array<{ properties: { code: string; name: string }; geometry: { type: string; coordinates: unknown[] } }>;
};
const geographyManifest = JSON.parse(await readFile(resolve(ROOT, "data/raw/valmyndigheten/geography-source-manifest.json"), "utf8")) as {
  expectedMunicipalities: number;
  normalizedSha256: string;
};
const seatContents = await readFile(resolve(ROOT, "data/normalized/riksdag-seat-model-inputs.json"));
const seatData = JSON.parse(seatContents.toString("utf8")) as RiksdagSimulatorData;
const seatManifest = JSON.parse(await readFile(resolve(ROOT, "data/raw/valmyndigheten/seat-source-manifest.json"), "utf8")) as {
  normalizedSha256: string;
};
const pollContents = await readFile(resolve(ROOT, "data/raw/polls/SwedishPolls.csv"), "utf8");
const pollManifest = JSON.parse(await readFile(resolve(ROOT, "data/raw/polls/source-manifest.json"), "utf8")) as {
  rawSha256: string;
  normalizedForecastSha256: string;
  expectedRows: number;
  latestPollPublication: string;
  sourceCommit: string;
  primaryCrossChecks: Array<{ publisher: string; publishedAt: string; expected: Record<string, number> }>;
};
const forecastContents = await readFile(resolve(ROOT, "data/normalized/election-forecast-2026.json"), "utf8");
const forecast = JSON.parse(forecastContents) as ElectionForecast;
const polls = parsePollCsv(pollContents);

assert(election.schemaVersion === 1, "Unexpected election schema version");
assert(election.source.publisher === "Valmyndigheten", "Election source must be Valmyndigheten");
assert(election.national.parties.length === PARTY_IDS.length, "National result must contain every canonical party bucket");
assert(election.constituencies.length === 29, `Expected 29 constituencies, found ${election.constituencies.length}`);
assert(election.municipalities.length === 290, `Expected 290 municipalities, found ${election.municipalities.length}`);
assert(history.elections.map(({ year }) => year).join(",") === "2002,2006,2010,2014,2018,2022", "History must cover six general elections");
assert(history.elections[0].validVotes === 5_303_212 && history.elections[0].turnout === 80.11, "Official 2002 national baseline mismatch");
assert(municipalityHistory.schemaVersion === 1, "Unexpected municipality-history schema version");
assert(municipalityHistory.source.publisher === "Valmyndigheten", "Municipality history source must be Valmyndigheten");
assert(municipalityHistory.source.sourceSha256 === municipalityHistoryManifest.election2018.sha256, "Municipality source checksum metadata mismatch");
assert(createHash("sha256").update(municipalityHistoryContents).digest("hex") === municipalityHistoryManifest.normalizedSha256, "Normalized municipality-history checksum mismatch");
assert(municipalityHistory.municipalities.length === municipalityHistoryManifest.expected2018.municipalities, "Unexpected 2018 municipality count");
assert(municipalityHistory.municipalities.reduce((sum, area) => sum + area.validVotes, 0) === municipalityHistoryManifest.expected2018.validVotes, "2018 municipality valid votes do not reconcile");
assert(municipalityHistory.municipalities.reduce((sum, area) => sum + area.totalVotes, 0) === municipalityHistoryManifest.expected2018.totalVotes, "2018 municipality total votes do not reconcile");
assert(municipalityHistory.municipalities.reduce((sum, area) => sum + area.eligibleVoters, 0) === municipalityHistoryManifest.expected2018.eligibleVoters, "2018 municipality eligible voters do not reconcile");
assert(municipalityHistory.geographyComparison.status === "comparable", "Municipality comparison must retain official comparability status");
assert(geography.schemaVersion === 1, "Unexpected geography schema version");
assert(geography.source.publisher === "Valmyndigheten", "Geography source must be Valmyndigheten");
assert(geography.source.classification === "OFFICIAL", "Geography must retain its official classification");
assert(geography.features.length === geographyManifest.expectedMunicipalities, `Expected ${geographyManifest.expectedMunicipalities} municipality geometries`);
assert(createHash("sha256").update(geographyContents).digest("hex") === geographyManifest.normalizedSha256, "Normalized geography checksum mismatch");
assert(createHash("sha256").update(seatContents).digest("hex") === seatManifest.normalizedSha256, "Normalized seat-model checksum mismatch");
assert(seatData.schemaVersion === 1, "Unexpected simulator-data schema version");
assert(seatData.source.publisher === "Valmyndigheten", "Simulator inputs must retain Valmyndigheten provenance");
assert(seatData.rules.version === RIKSDAG_RULES.version, "Simulator rule version mismatch");
assert(seatData.rules.totalSeats === 349 && seatData.rules.fixedSeats === 310 && seatData.rules.adjustmentSeats === 39, "Unexpected Riksdag seat structure");
assert(seatData.backtests.map(({ year }) => year).join(",") === "2018,2022", "Seat engine must retain 2018 and 2022 backtests");
for (const backtest of seatData.backtests) {
  const archiveSeats = electionArchive.elections.find(e => e.year === backtest.year)!.seats.parties;
  for (const party of SIMULATOR_PARTY_IDS) assert(archiveSeats[party] === backtest.expected.total[party], `Archive ${backtest.year} ${party} seats differ from the official seat-engine baseline`);
}
assert(Object.keys(seatData.scenario.fixedSeatsByConstituency).length === 29, "Expected 29 official 2026 constituency seat counts");
assert(Object.values(seatData.scenario.fixedSeatsByConstituency).reduce((sum, seats) => sum + seats, 0) === 310, "Official 2026 fixed seats must sum to 310");
assert(createHash("sha256").update(pollContents).digest("hex") === pollManifest.rawSha256, "Raw opinion-poll checksum mismatch");
assert(createHash("sha256").update(forecastContents).digest("hex") === pollManifest.normalizedForecastSha256, "Normalized forecast checksum mismatch");
assert(polls.length === pollManifest.expectedRows, `Expected ${pollManifest.expectedRows} opinion polls`);
validateForecastInputs(polls, pollManifest.latestPollPublication);
assert(forecast.schemaVersion === 1 && forecast.classification === "MODEL" && forecast.status === "BETA", "Forecast classification mismatch");
assert(forecast.model.version === "1.0.0-beta.1", "Forecast model version mismatch");
assert(forecast.model.windowDays === 180 && forecast.model.halfLifeDays === 28, "Forecast averaging configuration must remain frozen");
assert(forecast.model.dataCutoff === pollManifest.latestPollPublication, "Forecast data cutoff is stale");
assert(forecast.model.simulations === 10_000, "Production forecast must retain 10,000 deterministic simulations");
assert(forecast.source.rawSha256 === pollManifest.rawSha256 && forecast.source.upstreamCommit === pollManifest.sourceCommit, "Forecast poll provenance mismatch");
assert(forecast.evidence.currentWindowPolls === qualifyingPolls(polls, forecast.model.dataCutoff, forecast.model.windowDays).length, "Forecast current-window poll count mismatch");
assert(forecast.source.adapterVersion === POLLS_ADAPTER_VERSION, "Forecast must use the current reviewed source adapter");
assert(JSON.stringify(forecast.source.publicationDateCorrections) === JSON.stringify(PUBLICATION_DATE_CORRECTIONS), "Forecast publication-date correction provenance mismatch");
assert(forecast.model.horizonDays === daysBetween(forecast.model.dataCutoff, forecast.model.electionDate), "Forecast horizon mismatch");
for (const backtest of forecast.backtests) {
  const historicalElection = history.elections.find(({ year }) => year === backtest.year);
  assert(historicalElection, `Unknown historical forecast election ${backtest.year}`);
  assert(backtest.cutoff === subtractDays(historicalElection.electionDate, forecast.model.horizonDays), `Historical cutoff mismatch for ${backtest.year}`);
  assert(backtest.role === (backtest.year === 2022 ? "holdout" : "calibration"), `Historical role mismatch for ${backtest.year}`);
  const eligible = qualifyingPolls(polls, backtest.cutoff, forecast.model.windowDays);
  assert(backtest.polls === eligible.length && backtest.houses === new Set(eligible.map(({ house }) => house)).size, `Historical polling coverage mismatch for ${backtest.year}`);
}
assert(forecast.evidence.maximumRealizedHouseWeight <= forecast.model.maximumHouseWeight + 1e-6, "Polling-house weight cap was exceeded");
assert(forecast.evidence.officialHistoryElections === 6 && forecast.evidence.comparableBacktestElections === 4, "Forecast evidence must separate official history from comparable modern backtests");
assert(forecast.backtests.map(({ year }) => year).join(",") === "2010,2014,2018,2022", "Forecast backtests must use complete modern eight-party elections only");
assert(forecast.backtests.filter(({ role }) => role === "calibration").length === 3 && forecast.backtests.filter(({ role }) => role === "holdout").length === 1, "Forecast calibration/holdout split mismatch");
assert(forecast.parties.length === 8 && forecast.parties.every((party) => party.seatInterval80[0] <= party.medianSeats && party.medianSeats <= party.seatInterval80[1]), "Forecast party intervals are invalid");
assert(Object.values(forecast.centralScenario.seats).reduce((sum, seats) => sum + seats, 0) === 349, "Forecast central scenario must allocate 349 seats");
assert(forecast.questions.length >= 6 && forecast.questions.every((question) => question.classification === "MODEL" && question.probability >= 0 && question.probability <= 1), "Forecast probabilities are invalid");
assert(forecast.quality.seatTieLotSimulations >= 0 && forecast.quality.seatTieLotSimulations <= forecast.model.simulations, "Forecast tie-lot audit is invalid");

const publisherAliases: Record<string, string[]> = { Novus: ["Novus"], "SVT/Verian": ["Sifo", "Verian"], SCB: ["SCB"] };
for (const crossCheck of pollManifest.primaryCrossChecks) {
  const poll = polls.find((observation) => observation.publishedAt === crossCheck.publishedAt && (publisherAliases[crossCheck.publisher] ?? [crossCheck.publisher]).includes(observation.company));
  assert(poll, `Missing primary opinion-poll cross-check ${crossCheck.publisher}`);
  for (const [key, expected] of Object.entries(crossCheck.expected)) {
    const actual = key === "n" ? poll.sampleSize : poll.shares[key as keyof typeof poll.shares];
    assert(actual === expected, `Primary cross-check mismatch for ${crossCheck.publisher} ${key}`);
  }
}

for (const backtest of seatData.backtests) {
  assert(backtest.constituencies.length === 29, `${backtest.year} seat backtest must contain 29 constituencies`);
  const result = calculateRiksdagSeats(backtest);
  for (const partyId of SIMULATOR_PARTY_IDS) {
    const actual = result.parties.find((party) => party.partyId === partyId);
    assert(actual?.fixedSeats === backtest.expected.fixed[partyId], `${backtest.year} ${partyId} fixed-seat backtest failed`);
    assert(actual.adjustmentSeats === backtest.expected.adjustment[partyId], `${backtest.year} ${partyId} adjustment-seat backtest failed`);
    assert(actual.totalSeats === backtest.expected.total[partyId], `${backtest.year} ${partyId} total-seat backtest failed`);
  }
}

const municipalityNames = new Map(election.municipalities.map((municipality) => [municipality.code, municipality.name]));
const previousMunicipalityNames = new Map(municipalityHistory.municipalities.map((municipality) => [municipality.code, municipality.name]));
for (const feature of geography.features) {
  assert(municipalityNames.get(feature.properties.code) === feature.properties.name, `Geography join mismatch for ${feature.properties.code}`);
  assert(previousMunicipalityNames.get(feature.properties.code) === feature.properties.name, `2018 municipality join mismatch for ${feature.properties.code}`);
  assert(feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon", `Invalid geometry type for ${feature.properties.code}`);
  assert(feature.geometry.coordinates.length > 0, `Empty geometry for ${feature.properties.code}`);
}

for (const area of [election.national, ...election.constituencies, ...election.municipalities]) {
  assert(area.validVotes > 0, `${area.name} has no valid votes`);
  assert(area.totalVotes >= area.validVotes, `${area.name} has fewer total than valid votes`);
  assert(area.eligibleVoters >= area.totalVotes, `${area.name} has more votes than eligible voters`);
  assert(area.parties.reduce((sum, party) => sum + party.votes, 0) === area.validVotes, `${area.name} party vote sum is invalid`);
}

for (const area of municipalityHistory.municipalities) {
  assert(area.validVotes > 0, `${area.name} has no valid 2018 votes`);
  assert(area.parties.reduce((sum, party) => sum + party.votes, 0) === area.validVotes, `${area.name} 2018 party vote sum is invalid`);
}

console.log(
  `Verified election intelligence: ${election.national.validVotes.toLocaleString("en-US")} official 2022 votes, ${polls.length.toLocaleString("en-US")} checksum-pinned poll rows, ${forecast.model.simulations.toLocaleString("en-US")} deterministic forecast runs, ${geography.features.length} municipalities and ${seatData.backtests.length} exact seat-engine backtests.`,
);
