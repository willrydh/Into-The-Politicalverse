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
