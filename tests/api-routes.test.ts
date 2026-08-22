import assert from "node:assert/strict";
import test from "node:test";
import { GET as getNational } from "../app/api/elections/2022/national.json/route";
import { GET as getConstituencies } from "../app/api/elections/2022/geography/constituencies.json/route";
import { GET as getMunicipalities } from "../app/api/elections/2022/geography/municipalities.json/route";
import { GET as getMunicipalityComparison } from "../app/api/elections/comparisons/2018-2022/municipalities.json/route";
import { GET as getForecast } from "../app/api/forecasts/2026.json/route";
import { GET as getGovernmentContext } from "../app/api/context/government-formation-2026.json/route";

test("national API exposes the verified final result", async () => {
  const response = getNational();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.election.status, "final");
  assert.equal(payload.result.validVotes, 6_477_970);
  assert.equal(payload.result.parties.length, 9);
  assert.equal(payload.source.publisher, "Valmyndigheten");
});

test("static geography APIs expose both supported aggregations", async () => {
  const municipalityResponse = getMunicipalities();
  const municipalityPayload = await municipalityResponse.json();
  assert.equal(municipalityPayload.level, "municipality");
  assert.equal(municipalityPayload.areas.length, 290);

  const constituencyPayload = await getConstituencies().json();
  assert.equal(constituencyPayload.level, "constituency");
  assert.equal(constituencyPayload.areas.length, 29);
});

test("static comparison API identifies its derived method and official inputs", async () => {
  const payload = await getMunicipalityComparison().json();
  assert.equal(payload.classification, "DERIVED");
  assert.equal(payload.methodology.id, "municipality-swing");
  assert.equal(payload.methodology.version, "1.0.0");
  assert.equal(payload.comparisons.length, 290);
  assert.equal(payload.sources.every((source: { classification: string }) => source.classification === "OFFICIAL"), true);
});

test("forecast API exposes the versioned reproducible model snapshot", async () => {
  const response = getForecast();
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.classification, "MODEL");
  assert.equal(payload.model.version, "1.0.0-beta.1");
  assert.equal(payload.model.simulations, 10_000);
  assert.equal(Object.values(payload.centralScenario.seats).reduce((sum: number, seats) => sum + Number(seats), 0), 349);
});

test("government-context API exposes declarations separately from model output", async () => {
  const payload = await getGovernmentContext().json();
  assert.equal(payload.classification, "CONTEXT");
  assert.equal(payload.partyContexts.length, 8);
  assert.ok(payload.partyContexts.every((party: { claims: Array<{ classification: string }> }) => party.claims.every((claim) => claim.classification === "DECLARED")));
});
