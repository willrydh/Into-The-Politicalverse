import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
const raw = JSON.parse(gunzipSync(readFileSync("tests/fixtures/valmyndigheten-2026/current-model.json.gz")).toString("utf8"));
import { validatePublicFeed, acceptPublicFeed } from "../lib/live/public-feed";
import { currentProjection, projectedCoalitionSeats, majorityLabel } from "../lib/nowcast/current";
import { publicScenarioInput } from "../lib/nowcast/scenario";
import { calculateRiksdagSeats } from "../lib/simulator/riksdag-rules";
import { createLiveStore } from "../lib/live/store";
import { emptyFeed } from "../lib/live/collector";
const live = () => validatePublicFeed(structuredClone(raw));

test("all current displays take seats and probabilities from the same validated source generation", () => {
  const feed = live();
  const current = currentProjection(feed, false);
  assert.ok(current.estimate && current.probability && current.source);
  assert.equal(current.estimate, feed.nowcast!.estimate);
  assert.equal(current.probability, current.estimate.probability);
  assert.equal(projectedCoalitionSeats(current.estimate, ["S", "V", "MP", "C"])! + projectedCoalitionSeats(current.estimate, ["M", "SD", "KD", "L"])!, 349);
  assert.equal(majorityLabel(603, 1000, "sv-SE"), "60 %");
  assert.equal(majorityLabel(603, 1000, "en-GB"), "60 %");
  const input = publicScenarioInput(current.estimate, feed);
  assert.ok(input);
  const result = calculateRiksdagSeats(input);
  for (const party of result.parties) assert.equal(party.totalSeats, current.estimate.rows.find(r => r.partyId === party.partyId)!.seats);
});

test("unavailable, stale, unsupported and mixed-generation projections never fall back to a pre-election model", () => {
  assert.equal(currentProjection(live(), true).estimate, null);
  for (const mutate of [
    (f: ReturnType<typeof live>) => { f.nowcast!.status = "error"; },
    (f: ReturnType<typeof live>) => { f.nowcast!.source!.archiveMd5 = "0".repeat(32); },
    (f: ReturnType<typeof live>) => { f.nowcast!.estimate!.matchedDistricts = 1; },
    (f: ReturnType<typeof live>) => { f.nowcast!.estimate!.rows[0].seats = null; },
  ]) {
    const feed = live(); mutate(feed);
    const current = currentProjection(feed, false);
    assert.equal(current.estimate, null);
    assert.equal(current.probability, null);
    assert.equal(projectedCoalitionSeats(current.estimate, ["S"]), null);
  }
});

test("optional simulator inputs reject wrong geography, sums or seats without hiding valid model results", () => {
  for (const mutate of [
    (f: ReturnType<typeof live>) => { f.nowcast!.estimate!.scenarioInput!.constituencies[0].code = "99"; },
    (f: ReturnType<typeof live>) => { f.nowcast!.estimate!.scenarioInput!.constituencies[0].fixedSeats++; },
    (f: ReturnType<typeof live>) => { f.nowcast!.estimate!.scenarioInput!.nationalValidVotes++; },
    (f: ReturnType<typeof live>) => { f.nowcast!.estimate!.scenarioInput!.constituencies[0].partyVotes.S += 10000; },
  ]) {
    const feed = live(); mutate(feed);
    const { estimate } = currentProjection(feed, false);
    assert.ok(estimate);
    assert.equal(publicScenarioInput(estimate, feed), null);
  }
  const feed = live(); delete feed.nowcast!.estimate!.scenarioInput;
  assert.ok(currentProjection(feed, false).estimate);
  assert.equal(publicScenarioInput(currentProjection(feed, false).estimate, feed), null);
});

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
test("a shared live store uses one fetch for several consumers, retains a monotonic generation and recovers after failure", async () => {
  const initial = emptyFeed("production", "2026-09-13T18:00:00Z");
  const first = live();
  const newer = structuredClone(first); newer.checkedAt = new Date(Date.parse(first.checkedAt) + 60_000).toISOString();
  let payload: unknown = first, requests = 0, failed = false;
  const request = (async () => { requests++; if (failed) throw new Error("Offline"); return { ok: true, json: async () => payload } as Response; }) as typeof fetch;
  const store = createLiveStore(initial, request, () => Date.parse(newer.checkedAt));
  let notifications = 0;
  const remove1 = store.subscribe(() => notifications++);
  const remove2 = store.subscribe(() => notifications++);
  try {
    await flush(); assert.equal(requests, 1); assert.equal(notifications, 2);
    assert.equal(store.getSnapshot().feed, first);
    payload = newer; await store.refresh();
    assert.equal(store.getSnapshot().feed, newer);
    payload = first; await store.refresh();
    assert.equal(store.getSnapshot().feed, newer); assert.equal(store.getSnapshot().connectionError, true);
    failed = true; await store.refresh(); assert.equal(store.getSnapshot().feed, newer);
    failed = false; payload = newer; await store.refresh(); assert.equal(store.getSnapshot().connectionError, false);
    assert.equal(store.getServerSnapshot().feed, initial);
  } finally { remove1(); remove2(); }
});

test("unsubscribing and resubscribing cannot accept a late response from a previous mount", async () => {
  const initial = emptyFeed("production", "2026-09-13T18:00:00Z");
  const responses: ((r: Response) => void)[] = [];
  const request = (() => new Promise<Response>(resolve => responses.push(resolve))) as typeof fetch;
  const store = createLiveStore(initial, request);
  const stop = store.subscribe(() => {}); stop();
  const end = store.subscribe(() => {});
  try {
    responses[1]({ ok:true, json:async()=>live() } as Response); await flush();
    const accepted = store.getSnapshot().feed;
    responses[0]({ ok:true, json:async()=>initial } as Response); await flush();
    assert.equal(store.getSnapshot().feed, accepted);
    assert.equal(store.getSnapshot().connectionError, false);
    assert.throws(() => acceptPublicFeed(accepted, initial));
  } finally { end(); }
});
