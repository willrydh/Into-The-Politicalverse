import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { normalizeResult } from "../lib/live/result-adapter";
import { attachMunicipalSummary, checkAreaPartyShare, normalizeAreaResult } from "../lib/live/area-adapter";
import { areaIndexEntries, digest, INDEX_URLS } from "../lib/live/official-files";
import { normalizeComparison } from "../lib/live/comparison";
import { acceptAreaFeed, validateAreaFeed } from "../lib/live/public-area-feed";
import { collectAreaResults, emptyAreaFeed } from "../lib/live/area-collector";
import { areaIsEstablished, selectAreaResult, type AreaFeed } from "../lib/live/area-types";
import { aggregateMunicipalVotes } from "../lib/live/area-aggregate";
import { nationalCountIndicators } from "../lib/live/count-indicators";
import type { LiveResult } from "../lib/live/types";
import { matchesPercent } from "../lib/live/validation";
import { acceptPublicFeed, validatePublicFeed } from "../lib/live/public-feed";
import { createAreaStore } from "../lib/live/area-store";

const now = "2026-09-14T12:00:00.000Z";
type Fixture = { signed: { raw: Record<string, unknown>; source: LiveResult["source"] }; summary: { raw: unknown; source: LiveResult["source"] } | null };
const fixture = (name: string): Fixture => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/valmyndigheten-2026/areas/${name}.json.gz`, import.meta.url))).toString());
const rd = fixture("RD-00"), rf = fixture("RF-14"), kf = fixture("KF-1463");
const options = { mode: "production" as const, stage: "preliminary" as const, now, source: rd.signed.source };

test("same-source 2022 comparisons reproduce national votes, shares and seats", () => {
  const result = normalizeResult(rd.signed.raw, options), a = result.national;
  assert.equal(a.previous?.validVotes, 6477970);
  const m = a.previous!.parties.find(p => p.code === "0001")!;
  assert.equal(m.votes, 1237428); assert.equal(m.seats, 68);
  assert.equal(m.share, 1237428 / 6477970 * 100);
  assert.equal(a.parties.find(p => p.code === "0001")!.seats, 70);
  const indicators = nationalCountIndicators(a)!;
  assert.equal(indicators.gain.code, "0005"); assert.equal(indicators.loss.code, "0110");
  assert(indicators.volatility > 5 && indicators.volatility < 7);
});

test("unreviewed or absent comparisons stay absent; malformed numbers fail closed", () => {
  const area = structuredClone(rd.signed.raw.valomrade) as Record<string, unknown>;
  assert.equal(normalizeComparison(area, "2018-09-09"), null);
  assert.equal(normalizeComparison({ ...area, statusJamforelse: "Kan inte jämföras" }, "2022-09-11"), null);
  assert.equal(normalizeComparison({ ...area, rostfordelning: null }, "2022-09-11"), null);
  assert.throws(() => normalizeComparison({ ...area, totaltAntalRosterForegaendeVal: 1 }, "2022-09-11"));
});

test("percentage validation tolerates only serialization noise and keeps null distinct from zero", () => {
  const actual = 1237428 / 6477970 * 100;
  assert(matchesPercent(Number(actual.toPrecision(15)), actual));
  assert.equal(matchesPercent(actual + 0.00001, actual), false);
  assert.equal(matchesPercent(0, null), false); assert.equal(matchesPercent(null, 0), false);
});

test("municipal and regional mandates retain their own councils and local parties", () => {
  const mark = normalizeAreaResult(kf.signed.raw, { electionType: "KF", code: "1463", ...options, source: kf.signed.source });
  assert.equal(mark.area.validVotes, 21236); assert.equal(mark.area.previous!.validVotes, 22389);
  assert.equal(mark.area.parties.find(p => p.code === "0001")!.seats, 10);
  assert.equal(mark.area.parties.find(p => p.code === "0001")!.fixedSeats, null);
  const region = normalizeAreaResult(rf.signed.raw, { electionType: "RF", code: "14", ...options, source: rf.signed.source });
  attachMunicipalSummary(region, rf.summary!.raw, rf.summary!.source, now);
  assert.equal(region.area.parties.length, 12); assert.equal(region.municipalities.length, 49);
  assert(region.area.parties.some(p => p.code === "1297"));
  assert.throws(() => normalizeAreaResult(kf.signed.raw, { electionType: "RF", code: "14", ...options, source: kf.signed.source }));
  assert.throws(() => normalizeAreaResult(kf.signed.raw, { electionType: "KF", code: "1463", ...options, stage: "final-count", source: kf.signed.source }));
});

test("RD municipal totals reconcile to the national archive and never invent local mandates", () => {
  const result = normalizeAreaResult(rd.signed.raw, { electionType: "RD", code: "00", ...options });
  attachMunicipalSummary(result, rd.summary!.raw, rd.summary!.source, now);
  const national = aggregateMunicipalVotes(result.municipalities, "00", "Sverige");
  assert.equal(national.validVotes, result.area.validVotes);
  assert.equal(national.previous!.validVotes, result.area.previous!.validVotes);
  assert(national.parties.every(p => p.seats === null));
  assert.throws(() => aggregateMunicipalVotes([result.municipalities[0], result.municipalities[0]], "01", "County"));
  assert.throws(() => attachMunicipalSummary(result, rd.summary!.raw, { ...rd.summary!.source, archiveMd5: "0".repeat(32) }, now));
});

test("reviewed below-threshold display rounding does not change exact shares or widen other tolerances", () => {
  for (const code of ["0560", "0883", "1481", "1782", "22"]) {
    const signed = JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/valmyndigheten-2026/areas/threshold-${code}.json.gz`, import.meta.url))).toString());
    const r = normalizeAreaResult(signed.raw, { electionType: code.length === 2 ? "RF" : "KF", code, ...options, source: signed.source });
    for (const p of r.area.parties) assert.equal(p.share, p.votes / r.area.validVotes * 100);
    if (code === "1481") assert.equal(r.area.previous!.parties.find(p => p.code === "1760")!.votes, null);
  }
  checkAreaPartyShare(1.9, 1.9957, 2, "nej");
  assert.throws(() => checkAreaPartyShare(1.9, 2.001, 2, "nej"));
  assert.throws(() => checkAreaPartyShare(1.9, 1.9957, 2, "ja"));
  assert.throws(() => checkAreaPartyShare(1.9, 1.9957, undefined, "nej"));
});

test("area collector verifies signatures, skips unchanged ZIPs and retains results on failure", async () => {
  const zip = readFileSync(new URL("./fixtures/valmyndigheten-2026/areas/KF-1463.zip", import.meta.url));
  const path = "./p/kf/Val_2026_preliminar_1463_KF.zip", index = Buffer.from(`${digest(zip, "md5")}  ${path}\n`);
  const certificate = readFileSync(new URL("../data/raw/valmyndigheten-2026/val-sign-crt.pem", import.meta.url));
  let downloads = 0;
  const fetchFile = async (url: string) => { if (url === INDEX_URLS.production) return index; downloads++; return zip; };
  const first = await collectAreaResults(emptyAreaFeed(now), { now, certificate, fetchFile });
  assert.deepEqual(first.errors, []); assert.equal(downloads, 1); validateAreaFeed(first.feed);
  const next = await collectAreaResults(first.feed, { now, certificate, fetchFile });
  assert.equal(downloads, 1); assert.deepEqual(next.feed.results, first.feed.results);
  const failed = await collectAreaResults(first.feed, { now, certificate, fetchFile: async () => { throw new Error("offline"); } });
  assert.equal(failed.feed.status, "degraded"); assert.deepEqual(failed.feed.results, first.feed.results);
  assert.throws(() => areaIndexEntries(`${digest(zip, "md5")}  ./p/kf/../../evil.zip`));
  assert.throws(() => areaIndexEntries(index.toString().repeat(2)));
});

test("all published production areas pass client arithmetic and previous-generation guards", () => {
  const feed = validateAreaFeed(JSON.parse(readFileSync(new URL("../data/live/area-results-2026.json", import.meta.url), "utf8")));
  assert.equal(feed.published.preliminary.RD, 1); assert.equal(feed.published.preliminary.RF, 20); assert.equal(feed.published.preliminary.KF, 290);
  assert.equal(Object.keys(feed.results).filter(k => k.startsWith("preliminary/")).length, 311);
  assert.equal(feed.failures.length, 0);
  assert.equal(acceptAreaFeed(feed, feed), feed);
  const corrupt = structuredClone(feed); corrupt.results["preliminary/KF/1463"].area.parties[0].votes++;
  assert.throws(() => acceptAreaFeed(feed, corrupt));
  const regressed = structuredClone(feed); regressed.checkedAt = "2026-09-13T00:00:00Z";
  assert.throws(() => acceptAreaFeed(feed, regressed));
});

test("an older publisher cannot remove the newly verified national comparison", () => {
  const feed = validatePublicFeed(JSON.parse(readFileSync(new URL("../data/live/election-2026.json", import.meta.url), "utf8")));
  assert(feed.results.preliminary?.national.previous);
  assert.equal(acceptPublicFeed(feed, feed), feed);
  const legacy = structuredClone(feed);
  delete legacy.results.preliminary!.national.previous;
  assert.throws(() => acceptPublicFeed(feed, legacy), /comparison schema regressed/);
});

test("a new minute reaches the latest area generation even when the CDN caches each URL", async () => {
  const feed = validateAreaFeed(JSON.parse(readFileSync(new URL("../data/live/area-results-2026.json", import.meta.url), "utf8")));
  let clock = Date.parse(feed.checkedAt), published = JSON.stringify(feed);
  const cache = new Map<string, string>();
  const request: typeof fetch = async input => {
    const key = String(input);
    if (!cache.has(key)) cache.set(key, published);
    return new Response(cache.get(key), { status: 200 });
  };
  const store = createAreaStore(request, () => clock);
  let ready!: () => void;
  const first = new Promise<void>(resolve => { ready = resolve; });
  const unsubscribe = store.subscribe(() => ready());
  try {
    await first;
    assert.equal(store.getSnapshot().feed?.checkedAt, feed.checkedAt);
    clock += 60_000;
    const next = { ...feed, checkedAt: new Date(clock).toISOString() };
    published = JSON.stringify(next);
    await store.refresh();
    assert.equal(store.getSnapshot().feed?.checkedAt, next.checkedAt);
    assert.equal(store.getSnapshot().connectionError, false);
  } finally { unsubscribe(); }
});

test("partial final count does not replace the overall picture; establishment requires protocol and complete seats", () => {
  const result = normalizeAreaResult(kf.signed.raw, { electionType: "KF", code: "1463", ...options, source: kf.signed.source });
  const f = { ...structuredClone(result), stage: "final-count" as const };
  f.area.countedDistricts = 1;
  const feed: AreaFeed = { ...emptyAreaFeed(now), results: { "preliminary/KF/1463": result, "final-count/KF/1463": f } };
  assert.equal(selectAreaResult(feed, "KF", "1463"), result);
  assert.equal(selectAreaResult(feed, "KF", "1463", "final-count"), f);
  f.area.countedDistricts = f.area.totalDistricts;
  assert.equal(selectAreaResult(feed, "KF", "1463"), f); assert.equal(areaIsEstablished(f), false);
  f.protocolUrl = "https://resultat.val.se/protokoll/test.pdf"; assert.equal(areaIsEstablished(f), true);
  f.area.parties[0].seats = null; assert.equal(areaIsEstablished(f), false);
});
