import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { FORECAST_FREEZE_AT, forecastReferenceFrozen, selectForecastReference, validateForecastReference } from "../lib/forecast/reference";
import { evaluateForecast, forecastComparisonReference } from "../lib/forecast/evaluation";
import type { ElectionForecast } from "../lib/forecast/types";
import type { LiveResult } from "../lib/live/types";
import { CERTIFICATE_SHA256, LIVE_ADAPTER_VERSION } from "../lib/live/constants";
import { stageRiksdag2026 } from "../lib/live/stage-2026";
import { feedIsDelayed } from "../lib/live/public-feed";

const contents = readFileSync("data/normalized/election-forecast-2026.json", "utf8");
const forecast = JSON.parse(contents) as ElectionForecast;
const hash = createHash("sha256").update(contents).digest("hex");
const saved = selectForecastReference(null, forecast, hash, "2026-09-12T21:59:59.999Z");
const reference = forecastComparisonReference(saved);
const raw = () => JSON.parse(gunzipSync(readFileSync("tests/fixtures/valmyndigheten-2026/slutlig.json.gz")).toString());
const source: LiveResult["source"] = { adapterVersion: LIVE_ADAPTER_VERSION, archiveUrl: "https://resultat.val.se/resultatfiler/genrep2026/s/rd/Genrep_2026_slutlig_00_RD.zip", archiveMd5: "0".repeat(32), jsonSha256: "0".repeat(64), certificateSha256: CERTIFICATE_SHA256, signatureVerified: true };
const options = { mode: "rehearsal" as const, stage: "final-count" as const, now: "2026-09-07T20:00:00Z", source };
const staged = stageRiksdag2026(raw(), options);
// Arithmetic-only fixture, never exported or written to a production feed.
const counted = (): LiveResult => ({ ...structuredClone(staged.result), classification: "OFFICIAL", sourceUpdatedAt: "2026-09-16T12:00:00.000Z", protocolUrl: "https://resultat.val.se/protokoll/test-only.pdf" });

test("reference freezes at Swedish midnight before election day, including delayed or manual refreshes", () => {
  assert.equal(forecastReferenceFrozen("2026-09-12T21:59:59Z"), false);
  assert.equal(forecastReferenceFrozen(FORECAST_FREEZE_AT), true);
  const changed = { ...forecast, snapshotId: "post-election-change" };
  assert.equal(selectForecastReference(saved, changed, "a".repeat(64), FORECAST_FREEZE_AT), saved);
  assert.equal(selectForecastReference(saved, changed, "a".repeat(64), "2026-10-01T00:00:00Z"), saved);
  assert.throws(() => selectForecastReference(null, forecast, hash, FORECAST_FREEZE_AT), /retrospectively/);
  assert.throws(() => validateForecastReference({ ...saved, recordedAt: FORECAST_FREEZE_AT }), /after the freeze/);
  assert.throws(() => validateForecastReference({ ...saved, forecast: { ...forecast, model: { ...forecast.model, dataCutoff: "2026-09-13" } } }), /election-day/);
});

test("candidate intake keeps 2026 and rehearsal data separate and reconciles personal-vote lists", () => {
  assert.equal(staged.classification, "TEST");
  assert.equal(staged.publication, "staging-only");
  assert.equal(staged.personalVotes.length, 29);
  assert.ok(staged.personalVotes.every(a => a.year === 2026 && a.level === "constituency"));
  assert.ok(staged.personalVotes.some(a => a.parties.some(p => p.candidates === null)));
  const original = raw();
  const p = original.valomrade.valkretsLista[0].rostfordelning.rosterPaverkaMandat.partiRoster[0];
  const normalized = staged.personalVotes[0].parties[0];
  assert.equal(normalized.partyVotes, p.antalRoster);
  assert.equal(normalized.candidates![0].votes, p.summeradePersonroster[0].antalPersonroster);
  p.summeradePersonroster[0].antalPersonroster++;
  assert.throws(() => stageRiksdag2026(original, options), /lists and summed/);
  assert.throws(() => stageRiksdag2026(raw(), { ...options, mode: "production" }), /Test or rehearsal/);
  assert.throws(() => stageRiksdag2026(raw(), { ...options, stage: "preliminary" }), /final-count/);
});

test("comparison has no score before real counting or for a different election or geographic level", () => {
  assert.equal(evaluateForecast(reference, null), null);
  assert.equal(evaluateForecast(reference, staged.result), null);
  const r = counted(); r.national.validVotes = 0;
  assert.equal(evaluateForecast(reference, r), null);
  r.national = structuredClone(staged.result.constituencies[0]);
  assert.equal(evaluateForecast(reference, r), null);
  assert.equal(evaluateForecast(reference, { ...counted(), electionDate: "2022-09-11" as LiveResult["electionDate"] }), null);
});

test("result minus forecast uses all valid votes, and missing parties stay missing", () => {
  const r = counted();
  const comparison = evaluateForecast(reference, r)!;
  const m = comparison.rows.find(p => p.partyId === "M")!;
  const actual = r.national.parties.find(p => p.code === "0001")!;
  assert.equal(m.actualShare, actual.votes / r.national.validVotes * 100);
  assert.equal(m.shareDifference, m.actualShare! - m.meanShare);
  assert.equal(m.seatDifference, actual.seats! - m.centralSeats);
  r.national.parties = r.national.parties.filter(p => p.code !== "0001");
  const absent = evaluateForecast(reference, r)!;
  assert.equal(absent.rows.find(p => p.partyId === "M")!.actualShare, null);
  assert.equal(absent.meanAbsoluteError, null);
});

test("aggregate forecast scoring requires completed final counting, all seats and a protocol", () => {
  const r = counted();
  const complete = evaluateForecast(reference, r)!;
  assert.equal(complete.finalScore, true);
  assert.equal(complete.meanAbsoluteError, complete.rows.reduce((sum,p)=>sum+Math.abs(p.actualShare!-p.meanShare),0)/8);
  for (const changed of [
    { ...r, stage: "preliminary" as const },
    { ...r, protocolUrl: null },
    { ...r, national: { ...r.national, countedDistricts: r.national.totalDistricts - 1 } },
    { ...r, national: { ...r.national, parties: r.national.parties.map(p=>({...p,seats:null})) } },
  ]) assert.equal(evaluateForecast(reference, changed)!.meanAbsoluteError, null);
  const before = JSON.stringify(reference);
  r.sourceRevision++; r.national.parties[0].votes--;
  evaluateForecast(reference, r);
  assert.equal(JSON.stringify(reference), before);
});

test("post-count freshness matches daily checks while election night remains strict", () => {
  assert.equal(feedIsDelayed("2026-10-04T12:00:00Z", Date.parse("2026-10-05T14:00:00Z")), false);
  assert.equal(feedIsDelayed("2026-10-02T12:00:00Z", Date.parse("2026-10-05T14:00:00Z")), true);
  assert.equal(feedIsDelayed("2026-09-13T18:00:00Z", Date.parse("2026-09-13T18:16:00Z")), true);
});
