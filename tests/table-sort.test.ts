import test from "node:test";
import assert from "node:assert/strict";
import { sortTableRows } from "../lib/table-sort";
import { rankCandidates, voteChange } from "../lib/candidates/math";
import type { RankingRow } from "../lib/candidates/types";

test("numeric sorting precedes limiting and pagination and preserves source rows", () => {
  const source = Object.freeze(Array.from({ length: 120 }, (_, i) => Object.freeze({ id: i, votes: i * 103 })));
  const sorted = sortTableRows(source, r => r.votes, "descending", "sv");
  assert.deepEqual(sorted.slice(0, 3).map(r => r.id), [119, 118, 117]);
  assert.deepEqual(sorted.slice(50, 53).map(r => r.id), [69, 68, 67]);
  assert.equal(source[0].votes, 0);
  assert.equal(sorted[0], source[119]);
});

test("absent and undefined percentages stay last in both directions; zero is a real value", () => {
  const rows = [
    { id: "missing", percent: voteChange(100, null).percent },
    { id: "flat", percent: voteChange(100, 100).percent },
    { id: "rise", percent: voteChange(1455, 1000).percent },
    { id: "fall", percent: voteChange(500, 1000).percent },
    { id: "zero-baseline", percent: voteChange(100, 0).percent },
    { id: "invalid", percent: NaN },
  ];
  assert.deepEqual(sortTableRows(rows, r => r.percent, "descending", "sv").map(r => r.id), ["rise", "flat", "fall", "missing", "zero-baseline", "invalid"]);
  assert.deepEqual(sortTableRows(rows, r => r.percent, "ascending", "en").map(r => r.id), ["fall", "flat", "rise", "missing", "zero-baseline", "invalid"]);
});

test("Swedish names use Swedish alphabet order and ties retain their source order", () => {
  const names = ["Östen", "Åsa", "Anna", "Ägir", "Zara", "anna"];
  assert.deepEqual(sortTableRows(names, n => n, "ascending", "sv"), ["Anna", "anna", "Zara", "Åsa", "Ägir", "Östen"]);
  assert.deepEqual(sortTableRows(names, n => n, "descending", "sv").slice(-2), ["Anna", "anna"]);
  const thresholds = [null, false, true, undefined, true];
  assert.deepEqual(sortTableRows(thresholds, r => r, "descending", "sv"), [true, true, false, null, undefined]);
});

test("sorting a leaderboard changes display order without recalculating earned ranks", () => {
  const rows = [
    { person: "a", name: "Anna", areaCode: "01", votes: 100, supersededBy: null },
    { person: "b", name: "Bertil", areaCode: "01", votes: 1000, supersededBy: null },
    { person: "c", name: "Cecilia", areaCode: "01", votes: 100, supersededBy: null },
  ] as RankingRow[];
  const ranking = rankCandidates(rows, "votes");
  const byName = sortTableRows(ranking, r => r.row.name, "ascending", "sv");
  assert.deepEqual(byName.map(r => [r.row.name, r.rank]), [["Anna", 2], ["Bertil", 1], ["Cecilia", 2]]);
  assert.equal(ranking[0].row.name, "Bertil");
});
