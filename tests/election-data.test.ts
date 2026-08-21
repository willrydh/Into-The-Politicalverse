import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import test from "node:test";
import { getMunicipalityBreadth, getMunicipalityComparisons, getMunicipalityLeaders, getPartyChange, getPartyProfiles, municipalityHistory2018, nationalHistory, riksdag2022 } from "../lib/data/elections/index";
import { calculateNationalIndicators, effectiveNumberOfParties, topTwoConcentration } from "../lib/indicators/national";
import { parseHistoricalNationalCsv } from "../lib/data/valmyndigheten/history";
import { PARTIES, PARTY_ORDER } from "../lib/parties";

test("historical Valmyndigheten CSV parses into five validated elections", async () => {
  const input = await readFile("data/raw/valmyndigheten/riksdag-national-2002-2018.csv", "utf8");
  const elections = parseHistoricalNationalCsv(input);

  assert.deepEqual(elections.map(({ year }) => year), [2002, 2006, 2010, 2014, 2018]);
  assert.equal(elections[0].validVotes, 5_303_212);
  assert.equal(elections[0].parties.find(({ partyId }) => partyId === "SD")?.votes, 76_300);
  assert.equal(elections.at(-1)?.turnout, 87.18);
  assert.equal(elections.every((election) => election.parties.length === 9), true);
});

test("normalized 2022 national result reconciles exactly", () => {
  const partyVoteSum = riksdag2022.national.parties.reduce((sum, party) => sum + party.votes, 0);
  assert.equal(partyVoteSum, riksdag2022.national.validVotes);
  assert.equal(partyVoteSum, 6_477_970);
  assert.equal(riksdag2022.national.totalVotes, 6_547_801);
  assert.equal(riksdag2022.national.eligibleVoters, 7_775_390);
  assert.equal(riksdag2022.national.turnout, 84.21);
  assert.equal(riksdag2022.national.districtCount, 6_578);
  assert.equal(riksdag2022.source.classification, "OFFICIAL");
});

test("every parliamentary party has a checked-in local identity asset", async () => {
  const parliamentaryParties = PARTY_ORDER.filter((partyId) => partyId !== "OTHER");
  await Promise.all(parliamentaryParties.map(async (partyId) => {
    const party = PARTIES[partyId];
    assert.ok(party.logo?.startsWith("/parties/"));
    assert.ok(party.logoSource?.startsWith("https://"));
    await access(`public${party.logo}`);
  }));
});

test("geography covers every constituency and municipality", () => {
  assert.equal(riksdag2022.constituencies.length, 29);
  assert.equal(riksdag2022.municipalities.length, 290);
  assert.equal(riksdag2022.municipalities.every((area) => area.parties.reduce((sum, party) => sum + party.votes, 0) === area.validVotes), true);

  const leaders = getMunicipalityLeaders();
  assert.deepEqual(leaders.map(({ partyId, count }) => [partyId, count]), [["S", 215], ["SD", 61], ["M", 14]]);
});

test("2018 municipality observations reconcile and join exactly to 2022", () => {
  assert.equal(municipalityHistory2018.source.publisher, "Valmyndigheten");
  assert.equal(municipalityHistory2018.source.classification, "OFFICIAL");
  assert.equal(municipalityHistory2018.municipalities.length, 290);
  assert.equal(municipalityHistory2018.municipalities.reduce((sum, area) => sum + area.validVotes, 0), 6_476_725);
  assert.equal(municipalityHistory2018.geographyComparison.status, "comparable");

  const comparisons = getMunicipalityComparisons();
  assert.equal(comparisons.length, 290);
  assert.equal(comparisons.every(({ previous, current }) => previous.code === current.code && previous.name === current.name), true);
  const stockholm = comparisons.find(({ code }) => code === "0180");
  assert.equal(stockholm?.swings.S, 4.31);
  assert.equal(stockholm?.turnoutChange, -3.28);
});

test("change-based geographic breadth is deterministic", () => {
  const breadth = getMunicipalityBreadth();
  assert.deepEqual(breadth.slice(0, 4).map(({ partyId, improved }) => [partyId, improved]), [["SD", 289], ["MP", 230], ["S", 187], ["M", 153]]);
  assert.deepEqual(breadth.find(({ partyId }) => partyId === "C"), { partyId: "C", improved: 0, declined: 290, unchanged: 0, comparable: 290, breadth: 0 });
});

test("official municipality geometry is complete, checksum-pinned and joinable", async () => {
  const contents = await readFile("data/normalized/municipality-boundaries-2022.geojson");
  const geography = JSON.parse(contents.toString("utf8")) as {
    source: { publisher: string; classification: string };
    features: Array<{ properties: { code: string; name: string }; geometry: { type: string } }>;
  };
  const manifest = JSON.parse(await readFile("data/raw/valmyndigheten/geography-source-manifest.json", "utf8")) as { normalizedSha256: string };
  const electionNames = new Map(riksdag2022.municipalities.map((municipality) => [municipality.code, municipality.name]));

  assert.equal(geography.source.publisher, "Valmyndigheten");
  assert.equal(geography.source.classification, "OFFICIAL");
  assert.equal(geography.features.length, 290);
  assert.equal(createHash("sha256").update(contents).digest("hex"), manifest.normalizedSha256);
  assert.equal(geography.features.every((feature) => electionNames.get(feature.properties.code) === feature.properties.name), true);
  assert.equal(geography.features.every((feature) => feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon"), true);
});

test("party profiles use real national and municipality values", () => {
  const profiles = getPartyProfiles();
  const moderates = profiles.find(({ partyId }) => partyId === "M");
  const socialDemocrats = profiles.find(({ partyId }) => partyId === "S");

  assert.equal(moderates?.strongestMunicipalities[0].name, "Danderyd");
  assert.equal(moderates?.strongestMunicipalities[0].share, 40.98);
  assert.equal(socialDemocrats?.strongestMunicipalities[0].name, "Piteå");
  assert.equal(socialDemocrats?.geographicBreadth.improved, 187);
  assert.equal(getPartyChange("SD"), 3.01);
});

test("Politicalverse indicators are reproducible from final results", () => {
  const indicators = calculateNationalIndicators();
  assert.deepEqual(indicators.map(({ id }) => id), ["national-swing", "electoral-momentum", "geographic-breadth", "turnout-trend"]);
  assert.equal(indicators[0].value, "5.76 pts");
  assert.equal(indicators[1].value, "SD +3.01 pp");
  assert.equal(indicators[2].value, "SD 289/290");
  assert.equal(indicators[2].methodologyVersion, "2.0.0");
  assert.equal(indicators[3].value, "-2.97 pp");
  assert.equal(effectiveNumberOfParties(), 5.33);
  assert.equal(topTwoConcentration(), 50.87);
  assert.deepEqual(nationalHistory.elections.map(({ year }) => year), [2002, 2006, 2010, 2014, 2018, 2022]);
});
