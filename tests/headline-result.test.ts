import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { validatePublicFeed } from "../lib/live/public-feed";
import { headlineResult, isEstablishedResult, reportedGroupSeats } from "../lib/live/headline-result";

// Reviewed production fixture; mutations below exercise future count transitions only.
const live = () => validatePublicFeed(JSON.parse(gunzipSync(readFileSync("tests/fixtures/valmyndigheten-2026/counted-result.json.gz")).toString()));

test("the homepage uses reported votes and seats, independently of model availability", () => {
  const feed = live(), result = feed.results.preliminary!;
  delete feed.nowcast;
  assert.equal(headlineResult(feed), result);
  const left = reportedGroupSeats(result.national, ["S", "V", "MP", "C"]);
  const right = reportedGroupSeats(result.national, ["M", "SD", "KD", "L"]);
  assert.equal(left! + right!, 349);
  assert.equal(reportedGroupSeats(result.national, ["S"]), result.national.parties.find(p => p.code === "0002")!.seats);
  feed.stageStatus.preliminary = "error";
  assert.equal(headlineResult(feed), result, "keep verified counts on source failure");
  feed.results.preliminary = null;
  assert.equal(headlineResult(feed), null);
});

test("a partial recount does not replace or add to the national preliminary picture", () => {
  const feed = live(), preliminary = feed.results.preliminary!;
  const final = structuredClone(preliminary);
  final.stage = "final-count";
  final.national.countedDistricts = 1;
  feed.results["final-count"] = final;
  assert.equal(headlineResult(feed), preliminary);
  assert.equal(isEstablishedResult(final), false);
  final.national.countedDistricts = final.national.totalDistricts;
  assert.equal(headlineResult(feed), final);
  assert.equal(isEstablishedResult(final), false, "all districts is not an established result without the protocol");
  final.protocolUrl = "https://resultat.val.se/protokoll/test.pdf";
  assert.equal(isEstablishedResult(final), true);
  assert.equal(isEstablishedResult(preliminary), false);
  final.national.parties[0].seats = null;
  assert.equal(isEstablishedResult(final), false, "the final mandate decision is also required");
});

test("a final-count-only feed is usable without claiming the incomplete count is final", () => {
  const feed = live(), final = feed.results.preliminary!;
  final.stage = "final-count";
  feed.results = { preliminary: null, "final-count": final };
  assert.equal(headlineResult(feed), final);
  assert.equal(isEstablishedResult(final), false);
  final.national.countedDistricts = 0;
  assert.equal(headlineResult(feed), null);
});

test("unknown mandates stay unknown; reported zero seats and parties outside the blocs are preserved", () => {
  const area = live().results.preliminary!.national;
  assert.equal(reportedGroupSeats(area, ["S", "S"]), null);
  const s = area.parties.find(p => p.code === "0002")!;
  const v = area.parties.find(p => p.code === "0005")!;
  v.seats! += s.seats!;
  s.seats = 0;
  assert.equal(reportedGroupSeats(area, ["S"]), 0);
  v.seats = v.seats! - 1;
  area.parties.push({ ...s, code: "9999", name: "Test party", seats: 1 });
  const left = reportedGroupSeats(area, ["S", "V", "MP", "C"]);
  const right = reportedGroupSeats(area, ["M", "SD", "KD", "L"]);
  assert.equal(left! + right!, 348, "an outside party is not assigned to either bloc");
  s.seats = null;
  assert.equal(reportedGroupSeats(area, ["V"]), null, "an incomplete national allocation is not a complete bloc comparison");
});

test("rehearsal and non-national data cannot become the homepage result", () => {
  const feed = live();
  feed.mode = "rehearsal";
  assert.equal(headlineResult(feed), null);
  feed.mode = "production";
  feed.results.preliminary!.classification = "TEST";
  assert.equal(headlineResult(feed), null);
  feed.results.preliminary!.classification = "OFFICIAL";
  feed.results.preliminary!.national.code = "01";
  assert.equal(headlineResult(feed), null);
});
