import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getNational } from "../app/api/elections/2022/national/route";
import { GET as getGeography } from "../app/api/elections/2022/geography/route";

test("national API exposes the verified final result", async () => {
  const response = getNational();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.election.status, "final");
  assert.equal(payload.result.validVotes, 6_477_970);
  assert.equal(payload.result.parties.length, 9);
  assert.equal(payload.source.publisher, "Valmyndigheten");
});

test("geography API selects the requested aggregation", async () => {
  const municipalityResponse = getGeography(
    new NextRequest("http://localhost/api/elections/2022/geography?level=municipality"),
  );
  const municipalityPayload = await municipalityResponse.json();

  assert.equal(municipalityResponse.status, 200);
  assert.equal(municipalityPayload.level, "municipality");
  assert.equal(municipalityPayload.areas.length, 290);

  const invalidResponse = getGeography(
    new NextRequest("http://localhost/api/elections/2022/geography?level=district"),
  );
  assert.equal(invalidResponse.status, 400);
});
