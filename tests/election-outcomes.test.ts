import assert from "node:assert/strict";
import test from "node:test";
import { nationalHistory } from "../lib/data/elections/index";
import { electionArchive, getElectionOutcome, summarizeElectionOutcome, validateElectionArchive } from "../lib/elections/outcomes";

test("six archived elections retain sourced block outcomes independently of the largest party", () => {
  validateElectionArchive(electionArchive);
  // Valmyndigheten's final allocated mandates; the leading bloc changes even though S is largest.
  const expected = [
    [2002, [191, 158], "left", "Göran Persson"],
    [2006, [171, 178], "right", "Fredrik Reinfeldt"],
    [2010, [156, 173, 20], "right", "Fredrik Reinfeldt"],
    [2014, [159, 141, 49], "left", "Stefan Löfven"],
    [2018, [144, 143, 62], "left", "Stefan Löfven"],
    [2022, [173, 176], "right", "Ulf Kristersson"],
  ] as const;
  for (const [year, seats, leader, primeMinister] of expected) {
    const result = getElectionOutcome(year);
    assert.deepEqual(result.blocs.map(b => b.seats), [...seats]);
    assert.equal(result.leaders[0].id, leader);
    assert.equal(result.government.primeMinister, primeMinister);
    const largestParty = [...nationalHistory.elections.find(e => e.year === year)!.parties].sort((a, b) => b.share - a.share)[0];
    assert.equal(largestParty.partyId, "S");
  }
});

test("bloc majority is distinct from cabinet majority and 173 seats do not meet the threshold", () => {
  const result2022 = getElectionOutcome(2022);
  assert.equal(result2022.majority, true);
  assert.equal(result2022.governmentSeats, 103);
  assert.equal(result2022.governmentMajority, false);
  assert.deepEqual(result2022.government.parties, ["M", "KD", "L"]);
  assert.equal(getElectionOutcome(2002).governmentMajority, false);
  assert.equal(getElectionOutcome(2006).governmentMajority, true);
  assert.equal(getElectionOutcome(2010).governmentSeats, 173);
  assert.equal(getElectionOutcome(2010).majority, false);
});

test("2018 retains election-day blocs and the separate January 2019 government", () => {
  const result = getElectionOutcome(2018);
  assert.equal(result.majority, false);
  assert.equal(result.government.formationDate, "2019-01-21");
  assert.deepEqual(result.government.parties, ["S", "MP"]);
  assert.deepEqual(result.blocs.find(b => b.id === "right")!.parties, ["M", "C", "L", "KD"]);
  assert.equal(result.government.sources.includes("january-2019"), true);
  assert.equal(result.governmentSeats, 116);
});

test("incomplete, invalid or overlapping seat allocations fail closed", () => {
  const original = electionArchive.elections.find(e => e.year === 2018)!;
  const overlap = structuredClone(original); overlap.blocs[0].parties.push("L");
  assert.throws(() => summarizeElectionOutcome(overlap), /overlapping/);
  const missingBloc = structuredClone(original); missingBloc.blocs.pop();
  assert.throws(() => summarizeElectionOutcome(missingBloc), /coverage/);
  const invalid = structuredClone(original); invalid.seats.parties.M -= 1;
  assert.throws(() => summarizeElectionOutcome(invalid), /sum to 349/);
  const missing = structuredClone(original); Reflect.deleteProperty(missing.seats.parties, "SD");
  assert.throws(() => summarizeElectionOutcome(missing), /missing or invalid/);
  const invalidGovernment = structuredClone(original); invalidGovernment.government.parties.push("S");
  assert.throws(() => summarizeElectionOutcome(invalidGovernment), /government context/);
});

test("a tie never invents a unique winning bloc", () => {
  const election = structuredClone(electionArchive.elections.find(e => e.year === 2018)!);
  election.seats.parties.L += 1; election.seats.parties.SD -= 1;
  const result = summarizeElectionOutcome(election);
  assert.deepEqual(result.leaders.map(b => b.seats), [144, 144]);
  assert.equal(result.majority, false);
});

test("unreviewed election years and missing source metadata cannot become archive results", () => {
  assert.throws(() => getElectionOutcome(2026), /no reviewed outcome/);
  const archive = structuredClone(electionArchive); delete archive.sources.governments;
  assert.throws(() => validateElectionArchive(archive), /source metadata/);
});
