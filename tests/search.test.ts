import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { buildSearchIndex } from "../lib/search/build";
import { normalizeSearch, prepareSearch, preferredSearchLink, safeSearchHref, searchEntries, validateSearchIndex } from "../lib/search/engine";
import { readLocalSelection } from "../lib/data/geography/local-selection";
import { validateLocalities } from "../lib/search/localities";
import { localizedHref, ROUTES } from "../lib/i18n/translate";
import type { LocalDistrictData, LocalElectionIndex } from "../lib/data/geography/local-types";
import type { PersonalVoteData } from "../lib/data/geography/personal-votes";
import type { LocalityData } from "../lib/search/localities";

const data = buildSearchIndex(); const index = prepareSearch(data.entries);
const read = <T,>(file: string): T => JSON.parse(readFileSync(`data/normalized/${file}`, "utf8"));
const geography = read<LocalElectionIndex>("local-election-index.json");
const personal = read<PersonalVoteData>("personal-votes-2022.json");
const districts = read<LocalDistrictData>("local-election-districts.json");
const find = (q: string) => searchEntries(index, q).hits.map(h => h.entry);

test("global search covers every imported identity without duplicating candidates across constituencies", () => {
  assert.equal(data.entries.filter(e => e.type === "county").length, 21);
  assert.equal(data.entries.filter(e => e.type === "municipality").length, 290);
  assert.equal(data.entries.filter(e => e.type === "district").length, 6554);
  assert.equal(data.entries.filter(e => e.type === "constituency").length, 29);
  assert.equal(data.entries.filter(e => e.type === "locality").length, 2017);
  assert.equal(data.entries.filter(e => e.id.startsWith("candidate:")).length, 5948);
  assert.equal(data.entries.filter(e => e.id.startsWith("candidate:")).reduce((n, e) => n + e.links!.length, 0), 13775);
  const byId = new Map(data.entries.map(e => [e.id, e]));
  for (const c of personal.constituencies) for (const person of c.candidates) {
    const result = byId.get(`candidate:${person.partyCode}:${person.id}`)!;
    assert.equal(result.title.sv, person.name);
    const link = result.links!.find(l => new URL(l.href, "https://example.test").searchParams.get("constituency") === c.code)!;
    const s = readLocalSelection(new URL(link.href, "https://example.test").search, geography);
    assert.equal(s.candidate, `${person.partyCode}:${person.id}`);
    assert.equal(s.party, person.partyId); assert.equal(s.year, 2022);
  }
});

test("all geographic destinations use exact official codes and preserve county/constituency distinctions", () => {
  for (const e of data.entries.filter(e => ["county", "municipality", "district", "locality"].includes(e.type))) {
    for (const l of e.links ?? [e]) {
      const s = readLocalSelection(new URL(l.href, "https://example.test").search, geography);
      assert.ok(geography.counties.some(c => c.code === s.county));
      if (s.municipality) assert.equal(geography.municipalities.find(m => m.code === s.municipality)!.parent, s.county);
      if (s.district) assert.ok(districts.municipalities[s.municipality].some(d => d.code === s.district));
    }
  }
  const fritsla = data.entries.find(e => e.id === "locality:1463TB104")!;
  assert.equal(new URL(fritsla.href, "https://example.test").searchParams.get("municipality"), "1463");
  const stockholm = data.entries.find(e => e.id === "locality:0180TC101")!;
  assert.equal(stockholm.links!.length, 12);
  assert.match(fritsla.description.en, /municipal election results/);
});

test("search handles Swedish accents, word order, prefixes, aliases and exact party abbreviations", () => {
  assert.equal(normalizeSearch("  BORÅS—Göteborg  "), "boras goteborg");
  assert.deepEqual(find("boras").map(e => e.id), find("Borås").map(e => e.id));
  assert.equal(find("Andersson Magdalena")[0].title.sv, "Magdalena Andersson");
  assert.equal(find("Petter Löb")[0].title.sv, "Petter Löberg");
  assert.equal(find("S")[0].id, "party:S");
  assert.equal(find("Social Democrats")[0].id, "party:S");
  assert.ok(find("FP").some(e => e.id === "party:L"));
  assert.equal(preferredSearchLink(find("Ulf Kristersson")[0], "Stockholms län")!.title.sv, "Stockholms län");
  assert.equal(find("Herfindahl")[0].href, "/indicators/");
  assert.ok(find("Monte Carlo").some(e => e.id === "topic:method"));
  assert.equal(find("Novus")[0].id, "poll-source:Novus");
  assert.ok(data.entries.some(e => e.id === "question:liberals-threshold" && e.href === "/forecasts/#liberals-threshold"));
});

test("typing mistakes are explicitly approximate, deterministic and never fuzzy-match tiny tokens or codes", () => {
  const typo = searchEntries(index, "Magdalena Andersosn");
  assert.equal(typo.approximate, true); assert.equal(typo.hits[0].entry.title.sv, "Magdalena Andersson");
  assert.equal(searchEntries(index, "Magdalena Andersson").approximate, false);
  assert.equal(searchEntries(index, "zx").hits.length, 0);
  assert.equal(searchEntries(index, "14909999").hits.length, 0);
  for (const q of ["", "   ", "🌳", "<script>alert(123456789)</script>", "absolutely nonexistent name"]) assert.equal(searchEntries(index, q).hits.length, 0);
});

test("filters retain total counts, all exported page routes are localized and malicious payloads fail closed", () => {
  const all = searchEntries(index, "Borås"); const towns = searchEntries(index, "Borås", "locality");
  assert.equal(all.total, towns.total); assert.equal(towns.hits.length, towns.counts.locality);
  assert.ok(towns.hits.every(h => h.entry.type === "locality"));
  for (const e of data.entries) {
    const route = new URL(e.href, "https://example.test").pathname.replace(/^\/|\/$/g, "");
    assert.ok((ROUTES as readonly string[]).includes(route));
    assert.ok(localizedHref(e.href, "en").startsWith("/en/"));
    assert.equal(localizedHref(localizedHref(e.href, "en"), "sv"), e.href);
  }
  for (const bad of ["javascript:alert(1)", "//evil.test/", "/\\evil.test", "/maps/\n", "/unknown/"]) assert.equal(safeSearchHref(bad), false);
  const damaged = structuredClone(data); damaged.entries[0].href = "https://evil.test";
  assert.throws(() => validateSearchIndex(damaged));
  const duplicate = { ...data, entries: [data.entries[0], data.entries[0]] };
  assert.throws(() => validateSearchIndex(duplicate));
  assert.ok(gzipSync(JSON.stringify(data)).length < 650_000, "Keep the on-demand index within the transfer budget");
});

test("SCB localities reject omissions, duplicate/unknown municipalities and broken provenance", () => {
  const places = read<LocalityData>("scb-localities-2023.json"); const codes = new Set(geography.municipalities.map(m => m.code));
  validateLocalities(places, codes);
  assert.throws(() => validateLocalities({ ...places, localities: places.localities.slice(1) }, codes));
  const invalid = structuredClone(places); invalid.localities[0].municipalities = ["9999"];
  assert.throws(() => validateLocalities(invalid, codes));
});
