import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PARTY_IDS, type NationalHistoryData, type NormalizedRiksdagData } from "../lib/data/elections/types";

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
  `Verified Valmyndigheten data: ${election.national.validVotes.toLocaleString("en-US")} valid votes, ${election.constituencies.length} constituencies, ${election.municipalities.length} municipalities and ${geography.features.length} municipality geometries.`,
);
