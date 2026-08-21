import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PARTY_IDS, type NationalHistoryData, type NormalizedRiksdagData } from "../lib/data/elections/types";
import { calculateRiksdagSeats, RIKSDAG_RULES } from "../lib/simulator/riksdag-rules";
import { SIMULATOR_PARTY_IDS, type RiksdagSimulatorData } from "../lib/simulator/types";

const ROOT = resolve(import.meta.dirname, "..");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const election = JSON.parse(await readFile(resolve(ROOT, "data/normalized/riksdag-2022.json"), "utf8")) as NormalizedRiksdagData;
const history = JSON.parse(await readFile(resolve(ROOT, "data/normalized/riksdag-national-history.json"), "utf8")) as NationalHistoryData;
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

assert(election.schemaVersion === 1, "Unexpected election schema version");
assert(election.source.publisher === "Valmyndigheten", "Election source must be Valmyndigheten");
assert(election.national.parties.length === PARTY_IDS.length, "National result must contain every canonical party bucket");
assert(election.constituencies.length === 29, `Expected 29 constituencies, found ${election.constituencies.length}`);
assert(election.municipalities.length === 290, `Expected 290 municipalities, found ${election.municipalities.length}`);
assert(history.elections.map(({ year }) => year).join(",") === "2006,2010,2014,2018,2022", "History must cover five general elections");
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
assert(Object.keys(seatData.scenario.fixedSeatsByConstituency).length === 29, "Expected 29 official 2026 constituency seat counts");
assert(Object.values(seatData.scenario.fixedSeatsByConstituency).reduce((sum, seats) => sum + seats, 0) === 310, "Official 2026 fixed seats must sum to 310");

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
for (const feature of geography.features) {
  assert(municipalityNames.get(feature.properties.code) === feature.properties.name, `Geography join mismatch for ${feature.properties.code}`);
  assert(feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon", `Invalid geometry type for ${feature.properties.code}`);
  assert(feature.geometry.coordinates.length > 0, `Empty geometry for ${feature.properties.code}`);
}

for (const area of [election.national, ...election.constituencies, ...election.municipalities]) {
  assert(area.validVotes > 0, `${area.name} has no valid votes`);
  assert(area.totalVotes >= area.validVotes, `${area.name} has fewer total than valid votes`);
  assert(area.eligibleVoters >= area.totalVotes, `${area.name} has more votes than eligible voters`);
  assert(area.parties.reduce((sum, party) => sum + party.votes, 0) === area.validVotes, `${area.name} party vote sum is invalid`);
}

console.log(
  `Verified Valmyndigheten data: ${election.national.validVotes.toLocaleString("en-US")} valid votes, ${election.constituencies.length} constituencies, ${election.municipalities.length} municipalities, ${geography.features.length} municipality geometries and ${seatData.backtests.length} exact seat backtests.`,
);
