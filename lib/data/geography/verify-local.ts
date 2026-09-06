import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PARTY_IDS, type NationalHistoryData, type NormalizedRiksdagData } from "../elections/types";
import { LOCAL_YEARS, type LocalElectionIndex, type LocalDistrictData, type LocalMap, type LocalObservation } from "./local-types";
import { sumObservations, validateObservation } from "./local-math";
import { validateDistrictPayload } from "./local-validation";
import type { PersonalVoteData } from "./personal-votes";

export async function verifyLocalData(root: string) {
  const json = async (p: string) => JSON.parse(await readFile(join(root, p), "utf8"));
  for (const file of ["local-geography-source-manifest.json", "personal-votes-source-manifest.json"]) {
    const manifest = await json(`data/raw/valmyndigheten/${file}`);
    for (const [p, sha] of Object.entries(manifest.outputs)) assert.equal(createHash("sha256").update(await readFile(join(root, p))).digest("hex"), sha, `Local artifact checksum ${p}`);
  }
  const index: LocalElectionIndex = await json("data/normalized/local-election-index.json");
  const districts: LocalDistrictData = await json("data/normalized/local-election-districts.json");
  const maps: { maps: Record<string, LocalMap> } = await json("data/normalized/district-paths-2022.json");
  const history: NationalHistoryData = await json("data/normalized/riksdag-national-history.json");
  const current: NormalizedRiksdagData = await json("data/normalized/riksdag-2022.json");
  const personal: PersonalVoteData = await json("data/normalized/personal-votes-2022.json");
  assert.equal(index.counties.length, 21); assert.equal(index.municipalities.length, 290); assert.equal(new Set(index.municipalities.map(m => m.code)).size, 290);
  assert.equal(Object.keys(districts.municipalities).length, 290); assert.equal(Object.keys(maps.maps).length, 290);
  for (const year of LOCAL_YEARS) {
    const reference = history.elections.find(r => r.year === year)!;
    const expected: LocalObservation = { year, validVotes: reference.validVotes, totalVotes: reference.totalVotes, eligibleVoters: reference.eligibleVoters, votes: Object.fromEntries(reference.parties.map(p => [p.partyId, p.votes])) as LocalObservation["votes"] };
    assert.deepEqual(index.national.results.find(r => r.year === year), expected);
    assert.deepEqual(sumObservations(index.municipalities.map(m => m.results.find(r => r.year === year)!), year), expected);
    assert.deepEqual(sumObservations(index.counties.map(c => c.results.find(r => r.year === year)!), year), expected);
    for (const county of index.counties) assert.deepEqual(county.results.find(r => r.year === year), sumObservations(index.municipalities.filter(m => m.parent === county.code).map(m => m.results.find(r => r.year === year)!), year));
  }
  for (const municipality of index.municipalities) {
    assert.deepEqual(municipality.results.map(r => r.year), [...LOCAL_YEARS]);
    assert.equal(municipality.parent, municipality.code.slice(0, 2));
    assert.equal(municipality.constituencies?.length, 1);
    const areas = districts.municipalities[municipality.code];
    validateDistrictPayload({ ...districts, municipalities: undefined, municipality: municipality.code, areas, map: maps.maps[municipality.code] }, municipality.code, municipality.results.find(r => r.year === 2022));
    for (const d of areas) assert.deepEqual(d.constituencies, municipality.constituencies);
  }
  const allDistricts = Object.values(districts.municipalities).flat();
  const comparable = allDistricts.filter(a => a.comparison?.status === "comparable");
  assert.equal(allDistricts.filter(a => a.level === "district").length, 6264); assert.equal(comparable.length, 4162);
  const previous = comparable.flatMap(a => a.comparison!.previousCodes); assert.equal(new Set(previous).size, previous.length, "Repeated historical district references");
  for (const a of allDistricts) for (const r of a.results) validateObservation(r);
  assert.deepEqual(index.municipalities.find(m => m.code === "0180")!.constituencies, ["01"]);
  assert.deepEqual(index.counties.find(c => c.code === "01")!.constituencies, ["01", "02"]);
  assert.deepEqual(index.municipalities.find(m => m.code === "1490")!.constituencies, ["19"]);
  assert.equal(index.counties.find(c => c.code === "14")!.constituencies?.length, 5);
  const collectionVotes = allDistricts.filter(d => d.level === "collection").map(d => d.results.find(r => r.year === 2022)!);
  assert.equal(sumObservations(collectionVotes, 2022).validVotes, 220641);
  assert.equal(sumObservations(collectionVotes, 2022).totalVotes, 223678);
  assert.equal(sumObservations(collectionVotes, 2022).eligibleVoters, 0);
  assert.equal(personal.year, 2022); assert.equal(personal.electionType, "RD"); assert.equal(personal.level, "constituency"); assert.equal(personal.constituencies.length, 29);
  assert.equal(personal.constituencies.flatMap(c => c.candidates).length, 13775);
  assert.equal(personal.constituencies.flatMap(c => c.candidates).reduce((s, c) => s + c.votes, 0), 1457836);
  for (const c of personal.constituencies) {
    const result = current.constituencies.find(r => r.code === c.code)!; const seen = new Set<string>();
    for (const candidate of c.candidates) {
      const key = `${candidate.partyCode}:${candidate.id}`; assert.ok(!seen.has(key)); seen.add(key);
      assert.ok(Number.isSafeInteger(candidate.votes) && candidate.votes >= 0 && candidate.votes <= candidate.partyVotes);
      if (candidate.partyId !== "OTHER") assert.equal(candidate.partyVotes, result.parties.find(p => p.partyId === candidate.partyId)?.votes);
    }
    for (const p of PARTY_IDS.filter(p => p !== "OTHER")) assert.ok(c.candidates.filter(candidate => candidate.partyId === p).reduce((s, candidate) => s + candidate.votes, 0) <= result.parties.find(party => party.partyId === p)!.votes);
  }
  return { counties: 21, municipalities: 290, districts: 6264, comparable: 4162, collectionValidVotes: 220641, personalVotes: 1457836 };
}
