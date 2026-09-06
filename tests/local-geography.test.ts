import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { verifyLocalData } from "../lib/data/geography/verify-local";
import { localSwing, localTurnout, sumObservations, voteShare } from "../lib/data/geography/local-math";
import { validateDistrictPayload } from "../lib/data/geography/local-validation";
import { localSelectionQuery, readLocalSelection } from "../lib/data/geography/local-selection";
import { aggregatePersonalVotes, clearsPersonalThreshold, personalShare, type PersonalVoteRow, type PersonalVoteData } from "../lib/data/geography/personal-votes";
import { parseLocalMunicipalityCsv } from "../lib/data/valmyndigheten/local-results";
import type { LocalDistrictData, LocalElectionIndex, LocalMap, LocalObservation } from "../lib/data/geography/local-types";

const index: LocalElectionIndex = JSON.parse(await readFile("data/normalized/local-election-index.json", "utf8"));
const districts: LocalDistrictData = JSON.parse(await readFile("data/normalized/local-election-districts.json", "utf8"));
const maps: { maps: Record<string, LocalMap> } = JSON.parse(await readFile("data/normalized/district-paths-2022.json", "utf8"));
const personal: PersonalVoteData = JSON.parse(await readFile("data/normalized/personal-votes-2022.json", "utf8"));

test("local outputs retain source checksums and reconcile all four elections at each geographic level", async () => {
  assert.deepEqual(await verifyLocalData(process.cwd()), { counties: 21, municipalities: 290, districts: 6264, comparable: 4162, collectionValidVotes: 220641, personalVotes: 1457836 });
});
test("late and overseas collection votes enter totals exactly once without inventing district turnout", () => {
  const rows = districts.municipalities["1490"];
  const collection = rows.find(a => a.level === "collection")!.results.find(r => r.year === 2022)!;
  const physical = rows.filter(a => a.level === "district").map(a => a.results.find(r => r.year === 2022)!);
  const total = index.municipalities.find(m => m.code === "1490")!.results.find(r => r.year === 2022)!;
  assert.deepEqual(sumObservations([...physical, collection], 2022), total);
  assert.equal(sumObservations(physical, 2022).validVotes + collection.validVotes, total.validVotes);
  assert.ok(collection.validVotes > 0); assert.equal(localTurnout(collection), null);
  assert.ok(voteShare(collection, "S")! > 0);
});
test("district history uses official merged references and withholds ambiguous or changed boundaries", () => {
  const merged = districts.municipalities["1407"].find(d => d.code === "14070101")!;
  assert.deepEqual(merged.comparison?.previousCodes, ["14070101", "14070103"]);
  assert.equal(merged.results.length, 2); assert.notEqual(localSwing(merged, "S"), null);
  for (const code of ["25810005", "25810006"]) {
    const ambiguous = districts.municipalities["2581"].find(d => d.code === code)!;
    assert.equal(ambiguous.comparison?.reason, "shared-baseline"); assert.equal(ambiguous.results.length, 1); assert.equal(localSwing(ambiguous, "S"), null);
  }
  const changed = Object.values(districts.municipalities).flat().find(d => d.comparison?.reason === "boundary-change")!;
  assert.equal(voteShare(changed.results.find(r => r.year === 2018), "S"), null);
});
test("county identity stays separate from Riksdag constituency codes", () => {
  assert.deepEqual(index.municipalities.find(m => m.code === "1490")!.constituencies, ["19"]);
  assert.deepEqual(index.counties.find(c => c.code === "01")!.constituencies, ["01", "02"]);
  const s = readLocalSelection("?county=01&municipality=1490&district=01800101&party=SD&year=2014", index);
  assert.equal(s.county, "14"); assert.equal(s.district, ""); assert.equal(s.year, 2014);
  assert.deepEqual(readLocalSelection(localSelectionQuery(s), index), s);
  const bad = readLocalSelection("?party=invalid&year=2026&municipality=9999&metric=swing", index);
  assert.equal(bad.party, "S"); assert.equal(bad.year, 2022); assert.equal(bad.municipality, "");
});
test("district API rejects wrong geography, missing collection rows and altered counts", () => {
  const expected = index.municipalities.find(m => m.code === "1490")!.results.find(r => r.year === 2022)!;
  const payload = { ...districts, municipality: "1490", areas: districts.municipalities["1490"], map: maps.maps["1490"] };
  validateDistrictPayload(payload, "1490", expected);
  assert.throws(() => validateDistrictPayload(payload, "1480", expected));
  assert.throws(() => validateDistrictPayload({ ...payload, areas: payload.areas.filter(a => a.level !== "collection") }, "1490", expected));
  const corrupt = structuredClone(payload); const r = corrupt.areas[0].results.find(r => r.year === 2022)!;
  r.validVotes++; r.totalVotes++; r.votes.S++;
  assert.throws(() => validateDistrictPayload(corrupt, "1490", expected), /reconcile/);
});
test("percentages use vote-weighted totals and retain missing denominators", () => {
  const r = (votes: number, validVotes: number): LocalObservation => ({ year: 2022, votes: { S: votes, OTHER: validVotes - votes, M: 0, C: 0, L: 0, KD: 0, V: 0, MP: 0, SD: 0 }, validVotes, totalVotes: validVotes, eligibleVoters: validVotes * 2 });
  assert.equal(voteShare(sumObservations([r(10, 10), r(0, 90)], 2022), "S"), 10);
  assert.equal(voteShare(r(0, 0), "S"), null);
  assert.throws(() => sumObservations([r(1, 1), { ...r(1, 1), year: 2018 }], 2022), /mixed-year/);
  assert.throws(() => parseLocalMunicipalityCsv("LAN;KOM\n1;80", 2014), /Missing historical column/);
});
test("personal votes merge ballot lists within a constituency and keep other constituencies separate", () => {
  const row: PersonalVoteRow = { constituency: "01", partyCode: "0001", partyId: "M", partyName: "Moderaterna", candidateId: "7", name: "Example Candidate", list: "A", position: "1", votes: 30 };
  const rows = [row, { ...row, list: "B", votes: 20 }, { ...row, constituency: "02", votes: 4 }];
  const result = aggregatePersonalVotes(rows, new Map([["01:Moderaterna", 1000], ["02:Moderaterna", 100]]), [{ code: "01", name: "One" }, { code: "02", name: "Two" }]);
  assert.equal(result[0].candidates[0].votes, 50); assert.equal(result[0].candidates[0].lists, 2);
  assert.equal(personalShare(result[0].candidates[0]), 5); assert.equal(clearsPersonalThreshold(result[0].candidates[0]), true);
  assert.equal(clearsPersonalThreshold(result[1].candidates[0]), false);
  assert.equal(personalShare({ votes: 0, partyVotes: 0 }), null);
  assert.throws(() => aggregatePersonalVotes([row, row], new Map([["01:Moderaterna", 1000]]), [{ code: "01", name: "One" }]), /Duplicate/);
  assert.throws(() => aggregatePersonalVotes([row], new Map(), [{ code: "01", name: "One" }]), /denominator/);
});
test("published personal vote anchors retain all-list totals and party-vote denominators", () => {
  const stockholm = personal.constituencies.find(c => c.code === "01")!;
  const candidate = stockholm.candidates.find(c => c.id === "25889" && c.partyId === "M")!;
  assert.equal(candidate.name, "Ulf Kristersson"); assert.equal(candidate.votes, 19972); assert.equal(candidate.lists, 2); assert.equal(candidate.partyVotes, 115706);
  assert.equal(stockholm.candidates.find(c => c.name === "Anders Ygeman")!.votes, 6979);
});
