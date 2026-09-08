import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSharePerson } from "../lib/candidates/build-sharing";
import { selectCandidateProfile } from "../lib/candidates/profile-selection";
import { selectShareScope, validateSharePerson } from "../lib/candidates/sharing";
import type { CandidateResult, Person } from "../lib/candidates/types";

// Synthetic fixtures are tests only; never published or imported as observations.
const row = (year: number, votes: number, extra: Partial<CandidateResult> = {}): CandidateResult => ({
  year: year as CandidateResult["year"], votes, id: "1", name: "Testperson", partyId: "M", partyCode: "0001", partyName: "Moderaterna", partyVotes: 10_000, lists: 1, ballotPositions: [{ listNumber: "0001000001", position: 4 }], electionType: "KF", areaCode: "1480", areaName: "Göteborg", level: "municipality", county: "14", supersededBy: null, boundaryKey: "same-area", ...extra,
});
const person = (results: CandidateResult[]): Person => ({ id: "p2018-1", name: "Testperson", aliases: ["Testperson"], sourceIds: ["2018:1"], linked: true, results });

test("sharing follows the visible profile scope and latest year, including after 2026", () => {
  const p = person([row(2018, 100), row(2022, 200), row(2026, 500), row(2030, 250), row(2022, 9, { electionType: "RD", level: "constituency", areaCode: "19" })]);
  const share = buildSharePerson(p);
  for (const query of ["", "election=KF&area=1480&year=2018", "election=RD&area=19", "election=bad&area=unknown"]) {
    const params = new URLSearchParams(query), ui = selectCandidateProfile(p, params), card = selectShareScope(share, params);
    assert.equal(card.election, ui.election); assert.equal(card.area, ui.area); assert.equal(card.year, ui.latest.year); assert.equal(card.votes, ui.latest.votes);
  }
  const s = share.scopes.find(s => s.election === "KF")!;
  assert.equal(s.year, 2030); assert.equal(s.percent, -50);
  assert.deepEqual(s.history.map(h => h.year), [2018, 2022, 2026, 2030]);
  validateSharePerson(share, p.id);
});

test("new elections and corrected counts change the image revision without changing the profile ID", () => {
  const a = buildSharePerson(person([row(2018, 100), row(2022, 200)]));
  const b = buildSharePerson(person([row(2018, 100), row(2022, 200), row(2026, 500)]));
  const c = buildSharePerson(person([row(2018, 100), row(2022, 200), row(2026, 501)]));
  assert.equal(a.id, b.id); assert.notEqual(a.revision, b.revision); assert.notEqual(b.revision, c.revision);
  assert.equal(b.scopes[0].percent, 150); assert.equal(c.scopes[0].percent, 150.5);
  assert.equal(a.revision, buildSharePerson(person([row(2018, 100), row(2022, 200)])).revision);
});

test("missing years, changed areas, zero baselines and re-runs cannot produce invented change", () => {
  const cases = [
    [row(2014, 9), row(2022, 50)],
    [row(2018, 10), row(2022, 50, { boundaryKey: "changed" })],
    [row(2018, 0), row(2022, 50)],
    [row(2018, 10, { supersededBy: 2019 }), row(2022, 50)],
    [row(2018, 10), row(2022, 50), row(2022, 5, { partyId: "S", partyCode: "0002" })],
  ];
  for (const results of cases) {
    const s = buildSharePerson(person(results)).scopes[0];
    assert.equal(s.percent, null);
    if (s.reason !== "zero-baseline") assert.equal(s.history.at(-1)!.connect, false);
  }
  const gap = buildSharePerson(person(cases[0])).scopes[0].history;
  assert.deepEqual(gap.map(p => p.votes), [9, null, 50]);
  const zero = buildSharePerson(person([row(2018, 20), row(2022, 0)])).scopes[0];
  assert.equal(zero.votes, 0); assert.equal(zero.percent, -100);
});

test("party changes retain year-correct names and comparisons within the same scope", () => {
  const s = buildSharePerson(person([row(2014, 10, { partyId: "L", partyCode: "0003" }), row(2018, 20, { partyId: "L", partyCode: "0003" }), row(2022, 50)])).scopes[0];
  assert.equal(s.percent, 150); assert.equal(s.previousParty, "L"); assert.equal(s.party, "M");
  assert.deepEqual(s.history.map(h => h.party), ["FP", "L", "M"]);
});

test("the public sharing contract rejects preliminary or malformed data", () => {
  const valid = buildSharePerson(person([row(2022, 50)]));
  for (const edit of [(p: typeof valid) => { p.scopes[0].votes = -1; }, (p: typeof valid) => { p.scopes[0].percent = 3; }, (p: typeof valid) => { Object.assign(p.scopes[0], { status: "preliminary" }); }, (p: typeof valid) => { p.scopes[0].history[0].connect = true; }]) {
    const copy = structuredClone(valid); edit(copy); assert.throws(() => validateSharePerson(copy, copy.id));
  }
});

test("sharing highlights cap at five, prioritize national ranks and retain the profile's tiers", async () => {
  const { shareStandingContext, shareStandingHighlights } = await import("../lib/candidates/sharing-standings");
  const { RANKING_METRICS } = await import("../lib/candidates/leaderboards");
  const share = buildSharePerson(person([row(2018, 100), row(2022, 200)])), s = share.scopes[0];
  const context = shareStandingContext(s, new URLSearchParams(), "a".repeat(64));
  const ranks = RANKING_METRICS.flatMap(metric => ([
    [metric, "national", 0, 51, 500], [metric, "county", 0, 50, 100], [metric, "area", 0, 49, 80], [metric, "area", 1, 1, 10],
  ] as import("../lib/candidates/standings").StandingRank[]));
  const records = [{ year: 2022 as const, election: "KF" as const, area: "1480", party: "0001", ranks }];
  const counties = [{ code: "14", name: "Västra Götalands län" }];
  const view = shareStandingHighlights(share, s, context, records, counties, "sv");
  assert.equal(view.total, 20); assert.equal(view.items.length, 5);
  assert.ok(view.items.every(r => r.placement === "Topp 100" && r.scope === "national"));
  const compact = shareStandingHighlights(share, s, context, [{ ...records[0], ranks: [["votes", "national", 1, 32, 100], ["votes", "area", 0, 49, 80], ["votes", "county", 0, 50, 100]] }], counties, "sv");
  assert.deepEqual(compact.items.map(r => r.placement), ["#32", "#49", "Topp 50"]);
  assert.equal(compact.items[0].detail, "Kommunval · Svenska moderater");
  assert.equal(shareStandingHighlights(share, s, context, [], counties, "sv").items.length, 0);
  assert.deepEqual(shareStandingHighlights(share, s, context, [...records, ...records], counties, "sv"), view);
  assert.equal(shareStandingHighlights(share, s, { ...context, year: 2018 }, records, counties, "sv").items.length, 0);
});

test("the OG selection follows the profile's year, party and fallback choices", async () => {
  const { shareStandingContext } = await import("../lib/candidates/sharing-standings");
  const { selectStandingCandidacy } = await import("../lib/candidates/standings");
  const { shareImageURL } = await import("../lib/candidates/sharing-metadata");
  const p = person([row(2018, 100, { partyId: "L", partyCode: "0003" }), row(2022, 200), row(2022, 20, { partyId: "S", partyCode: "0002" })]);
  const share = buildSharePerson(p), scope = share.scopes[0];
  for (const query of ["", "year=2018&peers=party", "year=1900&standingParty=bad", "standingParty=0002&peers=party"]) {
    const params = new URLSearchParams(query), expected = selectStandingCandidacy(selectCandidateProfile(p, params).results, params, 2022);
    const context = shareStandingContext(scope, params, "a".repeat(64));
    assert.equal(context.year, expected.year); assert.equal(context.partyCode, expected.selected.partyCode); assert.equal(context.partyOnly, expected.partyOnly);
    const url = new URL(shareImageURL("https://politicalverse.se", share, scope, "sv", context));
    const roundtrip = shareStandingContext(scope, url.searchParams, context.sourceVersion);
    assert.deepEqual(roundtrip, context);
  }
  const a = shareStandingContext(scope, new URLSearchParams(), "a".repeat(64));
  const b = { ...a, sourceVersion: "b".repeat(64) };
  assert.notEqual(shareImageURL("https://politicalverse.se", share, scope, "sv", a), shareImageURL("https://politicalverse.se", share, scope, "sv", b));
});


test("only Riksdag vote totals deduplicate across candidate areas", async () => {
  const { shareStandingContext, shareStandingHighlights } = await import("../lib/candidates/sharing-standings");
  const counties = [{ code: "14", name: "Västra Götalands län" }];
  for (const election of ["KF", "RD"] as const) {
    const share = buildSharePerson(person([
      row(2022, 200, { electionType: election, areaCode: "14", areaName: "Område A" }),
      row(2022, 100, { electionType: election, areaCode: "19", areaName: "Område B" }),
    ]));
    const scope = share.scopes[0], context = shareStandingContext(scope, new URLSearchParams(), "a".repeat(64));
    const records = share.scopes.map((s, i) => ({ year: 2022 as const, election, area: s.area, party: "0001", ranks: [["votes", "national", 1, election === "RD" ? 2 : 2 + i, 100]] as import("../lib/candidates/standings").StandingRank[] }));
    const result = shareStandingHighlights(share, scope, context, records, counties, "sv");
    assert.equal(result.total, election === "RD" ? 1 : 2);
    if (election === "KF") assert.notEqual(result.items[0].detail, result.items[1].detail);
  }
});
