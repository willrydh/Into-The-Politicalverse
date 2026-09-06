import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { normalizeResult, assertResultAdvance } from "../lib/live/result-adapter";
import { CERTIFICATE_SHA256, digest, indexEntry, verifySignedJson } from "../lib/live/official-files";
import { normalizeEarlyVoting, parseSemicolonCsv } from "../lib/live/early-voting";
import { sourceTimestamp } from "../lib/live/validation";
import type { CountingStage, LiveResult } from "../lib/live/types";
import { collectLiveData, emptyFeed } from "../lib/live/collector";
import { EARLY_VOTING_URL } from "../lib/live/early-voting";
import { acceptPublicFeed, feedIsDelayed, preferredStage, validatePublicFeed } from "../lib/live/public-feed";

import { LIVE_ADAPTER_VERSION } from "../lib/live/constants";

const now = "2026-09-06T15:00:00Z";
const certificate = readFileSync("data/raw/valmyndigheten-2026/val-sign-crt.pem");
const source: LiveResult["source"] = { adapterVersion: LIVE_ADAPTER_VERSION, archiveUrl: "https://resultat.val.se/resultatfiler/genrep2026/p/rd/Genrep_2026_preliminar_00_RD.zip", archiveMd5: "3e6407d8abce4a7856a396cd61e02724", jsonSha256: "b2e8a4473e790d1ff858a3cc85afd4f56f7977313937d69cbceba98303885156", certificateSha256: CERTIFICATE_SHA256, signatureVerified: true };
const fixture = (phase = "preliminar") => gunzipSync(readFileSync(`tests/fixtures/valmyndigheten-2026/${phase}.json.gz`));
const parse = (raw: unknown, stage: CountingStage = "preliminary") => normalizeResult(raw, { mode: "rehearsal", stage, now, source });

test("both real authority rehearsals verify cryptographically and reconcile every constituency", () => {
  for (const [phase, stage] of [["preliminar", "preliminary"], ["slutlig", "final-count"]] as const) {
    const bytes = fixture(phase);
    verifySignedJson(bytes, readFileSync(`tests/fixtures/valmyndigheten-2026/${phase}.sig`), certificate, now);
    const result = parse(JSON.parse(bytes.toString()), stage);
    assert.equal(result.classification, "TEST");
    assert.equal(result.constituencies.length, 29);
    assert.equal(result.national.countedDistricts, 6626);
    assert.equal(result.national.parties.reduce((sum, p) => sum + (p.seats ?? 0), 0), 349);
    assert.deepEqual(Object.fromEntries(result.national.parties.filter(p => (p.seats ?? 0) > 0).map(p => [p.abbreviation, p.seats])), { M: 69, C: 24, L: 16, KD: 17, S: 109, V: 24, MP: 17, SD: 73 });
    assert.notEqual(result.seatCheck.status, "not-applicable");
    if (stage === "preliminary") assert.equal(result.seatCheck.tieCount, 1);
    else assert.equal(result.seatCheck.status, "matched");
  }
});

test("production rejects authentic rehearsals, wrong election identity and ambiguous test flags", () => {
  const raw = JSON.parse(fixture().toString());
  assert.throws(() => normalizeResult(raw, { mode: "production", stage: "preliminary", now, source }), /Test or rehearsal/);
  assert.throws(() => parse({ ...raw, valdatum: "2022-09-11" }), /election identity/);
  assert.throws(() => parse(raw, "final-count"), /counting stage/);
  for (const flag of [true, "true", "false", 1]) assert.throws(() => normalizeResult({ ...raw, valtillfalle: "Val_2026", test: flag }, { mode: "production", stage: "preliminary", now, source }), /Test or rehearsal/);
});

test("invalid source signature, changed key and unsafe archive index fail closed", () => {
  const bytes = fixture(); const signature = readFileSync("tests/fixtures/valmyndigheten-2026/preliminar.sig");
  const changed = Buffer.from(bytes); changed[100] ^= 1;
  assert.throws(() => verifySignedJson(changed, signature, certificate, now), /signature/);
  assert.throws(() => verifySignedJson(bytes, signature, Buffer.from("different key"), now), /certificate/);
  assert.throws(() => indexEntry("a".repeat(32) + " ./p/../evil.zip", "production", "preliminary"), /unsafe/);
  const row = "a".repeat(32) + " ./p/rd/Val_2026_preliminar_00_RD.zip";
  assert.match(indexEntry(row, "production", "preliminary")!.url, /\/val2026\/p\/rd\//);
  assert.equal(indexEntry(row, "rehearsal", "preliminary"), null);
  assert.throws(() => indexEntry(`${row}\n${row}`, "production", "preliminary"), /Ambiguous/);
  assert.equal(digest(certificate), CERTIFICATE_SHA256);
});

test("vote denominators, duplicate identifiers, fixed seats and aggregation errors are rejected", () => {
  const modify = (change: (value: ReturnType<typeof JSON.parse>) => void) => { const d = JSON.parse(fixture().toString()); change(d); return d; };
  assert.throws(() => parse(modify(d => { d.valomrade.totaltAntalRoster++; })), /Valid plus invalid/);
  assert.throws(() => parse(modify(d => { d.valomrade.rostfordelning.rosterPaverkaMandat.partiRoster[0].andelRoster = 99; })), /denominator/);
  assert.throws(() => parse(modify(d => { d.valomrade.valkretsLista[1].kod = d.valomrade.valkretsLista[0].kod; })), /unique constituencies/);
  assert.throws(() => parse(modify(d => { d.valomrade.valkretsLista[0].totaltAntalFastaMandat++; })), /fixed-seat/);
  assert.throws(() => parse(modify(d => { d.valomrade.antalValdistriktSomSkaRaknas++; })), /reconcile/);
  assert.throws(() => parse(modify(d => { d.senasteUppdateringstid = "2026-09-07T12:00:00"; })), /Future/);
});

test("no counted districts means unknown percentages and seats, never a zero-percent result", () => {
  const raw = JSON.parse(fixture().toString());
  for (const area of [raw.valomrade, ...raw.valomrade.valkretsLista]) {
    area.antalValdistriktRaknade = 0; area.totaltAntalRoster = 0; area.antalRostberattigadeIRaknadeValdistrikt = 0; area.valdeltagande = 0; area.mandatfordelning = null;
    const valid = area.rostfordelning.rosterPaverkaMandat; valid.antalRoster = 0;
    for (const party of [...valid.partiRoster, valid.rosterOvrigaPartier]) { party.antalRoster = 0; party.andelRoster = 0; }
    area.rostfordelning.rosterEjPaverkaMandat.antalRoster = 0;
  }
  const result = parse(raw);
  assert.equal(result.national.turnoutInCountedDistricts, null);
  assert.ok(result.national.parties.every(p => p.share === null && p.seats === null));
  assert.equal(result.seatCheck.status, "not-applicable");
});

test("snapshot ordering rejects stale revisions but allows official numerical corrections", () => {
  const current = parse(JSON.parse(fixture().toString()));
  assert.throws(() => assertResultAdvance(current, { ...current, sourceRevision: current.sourceRevision - 1 }), /regressed/);
  assert.throws(() => assertResultAdvance(current, { ...current, source: { ...current.source, jsonSha256: "different" } }), /changed contents/);
  assert.doesNotThrow(() => assertResultAdvance(current, { ...current, sourceRevision: current.sourceRevision + 1, national: { ...current.national, totalVotes: current.national.totalVotes - 1 } }));
});

test("Swedish source clocks use the correct offset in summer and winter", () => {
  assert.equal(sourceTimestamp("2026-09-13T20:00:00"), "2026-09-13T18:00:00.000Z");
  assert.equal(sourceTimestamp("2026-12-01T12:00:00"), "2026-12-01T11:00:00.000Z");
  assert.throws(() => sourceTimestamp("2026-02-31T12:00:00"), /Invalid/);
});

const earlyCsv = 'LÄNSKOD;LÄN;KOMMUNKOD;KOMMUN;LOKALID;LOKAL;2026-08-26;2026-08-27;TOTAL\n01;Stockholm;14;Upplands Väsby;0114005;Bibliotek;10;20;30\n14;Västra Götaland;90;Borås;1490001;Stadshuset;5;15;20\n;;;;;SUMMA;15;35;50\n';
test("early-voting totals exclude the SUMMA row and use county plus municipality code", () => {
  const result = normalizeEarlyVoting(earlyCsv, { retrievedAt: now, rawSha256: "test" });
  assert.equal(result.receivedVotes, 50); assert.equal(result.locations, 2);
  assert.deepEqual(result.municipalities.map(m => m.code), ["0114", "1490"]);
  assert.equal(result.daily.reduce((s, d) => s + d.votes, 0), 50);
  assert.throws(() => normalizeEarlyVoting(earlyCsv.replace("SUMMA;15;35;50", "SUMMA;15;35;100"), { retrievedAt: now, rawSha256: "test" }), /grand total/);
  assert.deepEqual(parseSemicolonCsv('a;b\n"a;quoted";"two\nlines"\n'), [["a", "b"], ["a;quoted", "two\nlines"]]);
});

test("collector treats pre-election 404 as waiting, and outages retain verified early votes", async () => {
  const fetchFile = async (url: string) => url === EARLY_VOTING_URL ? Buffer.from(earlyCsv) : null;
  const first = await collectLiveData(emptyFeed("production", now), { mode: "production", now, certificate, fetchFile });
  assert.deepEqual(first.errors, []);
  assert.equal(first.feed.resultStatus, "awaiting-results");
  assert.equal(first.feed.earlyVoting?.receivedVotes, 50);
  validatePublicFeed(first.feed);
  const failed = await collectLiveData(first.feed, { mode: "production", now: "2026-09-13T20:00:00Z", certificate, fetchFile: async () => { throw new Error("Source outage"); } });
  assert.equal(failed.feed.resultStatus, "degraded");
  assert.equal(failed.feed.earlyVotingStatus, "error");
  assert.deepEqual(failed.feed.earlyVoting, first.feed.earlyVoting);
  assert.equal(failed.errors.length, 2);
  const late404 = await collectLiveData(first.feed, { mode: "production", now: "2026-09-13T20:00:00Z", certificate, fetchFile });
  assert.equal(late404.feed.resultStatus, "degraded");
  assert.match(late404.errors.join(" "), /unavailable after counting/);
});

test("unchanged archive checksums avoid downloads and an invalid phase cannot erase either snapshot", async () => {
  const previous = emptyFeed("rehearsal", now);
  previous.results.preliminary = parse(JSON.parse(fixture().toString()));
  previous.results["final-count"] = parse(JSON.parse(fixture("slutlig").toString()), "final-count");
  const makeIndex = (preliminaryHash: string) => Buffer.from(`${preliminaryHash} ./p/rd/Genrep_2026_preliminar_00_RD.zip\n${source.archiveMd5} ./s/rd/Genrep_2026_slutlig_00_RD.zip`);
  let archiveDownloads = 0;
  const fetchFile = async (url: string) => {
    if (url === EARLY_VOTING_URL) return Buffer.from(earlyCsv);
    if (url.endsWith("index.md5")) return makeIndex(source.archiveMd5);
    archiveDownloads++; throw new Error("Unnecessary archive download");
  };
  const unchanged = await collectLiveData(previous, { mode: "rehearsal", now, certificate, fetchFile });
  assert.deepEqual(unchanged.errors, []); assert.equal(archiveDownloads, 0);
  const damaged = await collectLiveData(unchanged.feed, { mode: "rehearsal", now, certificate, fetchFile: async url => url.endsWith("index.md5") ? makeIndex("a".repeat(32)) : url.endsWith(".zip") ? Buffer.from("damaged archive") : Buffer.from(earlyCsv) });
  assert.deepEqual(damaged.feed.results, unchanged.feed.results);
  assert.equal(damaged.feed.stageStatus.preliminary, "error");
  assert.equal(damaged.feed.stageStatus["final-count"], "ok");
  assert.equal(damaged.feed.earlyVotingStatus, "ok");
  assert.equal(damaged.errors.length, 1);
});

test("public feed rejects rehearsal, broken display arithmetic, stale data and loss of a counting phase", () => {
  const first = emptyFeed("production", now);
  first.earlyVoting = normalizeEarlyVoting(earlyCsv, { retrievedAt: now, rawSha256: digest(earlyCsv) }); first.earlyVotingStatus = "ok";
  validatePublicFeed(first);
  assert.throws(() => acceptPublicFeed(first, { ...first, mode: "rehearsal" }), /production/);
  assert.throws(() => acceptPublicFeed(first, { ...first, checkedAt: "2026-09-05T00:00:00Z" }), /regressed/);
  assert.throws(() => acceptPublicFeed(first, { ...first, earlyVoting: null }), /disappeared/);
  assert.throws(() => validatePublicFeed({ ...first, earlyVoting: { ...first.earlyVoting, receivedVotes: 51 } }), /total/);
  const rehearsal = parse(JSON.parse(fixture().toString()));
  assert.throws(() => validatePublicFeed({ ...first, results: { preliminary: rehearsal, "final-count": null } }), /Rehearsal/);
  // Synthetic production envelope exists only in this test; no production signature is claimed.
  const synthetic = { ...rehearsal, classification: "OFFICIAL" as const, source: { ...rehearsal.source, archiveUrl: "https://resultat.val.se/resultatfiler/val2026/p/rd/Val_2026_preliminar_00_RD.zip" } };
  const withResult = { ...first, results: { preliminary: synthetic, "final-count": null }, resultStatus: "ok" as const };
  validatePublicFeed(withResult);
  assert.throws(() => acceptPublicFeed(withResult, first), /disappeared/);
  const broken = structuredClone(withResult); broken.results.preliminary.national.turnoutInCountedDistricts = 99;
  assert.throws(() => validatePublicFeed(broken), /turnout/);
  assert.equal(preferredStage(withResult), "preliminary");
  assert.equal(feedIsDelayed("2026-09-13T20:00:00Z", Date.parse("2026-09-13T20:16:00Z")), true);
  assert.equal(feedIsDelayed(now, Date.parse("2026-09-06T16:00:00Z")), false);
});

test("additional eligible parties stay visible without silently using the eight-party model", () => {
  const raw = JSON.parse(fixture("slutlig").toString());
  for (const area of [raw.valomrade, ...raw.valomrade.valkretsLista]) {
    for (const p of area.rostfordelning.rosterPaverkaMandat.partiRoster) if (p.partikod === "0003") p.partikod = "0999";
    for (const p of area.mandatfordelning.partiLista) if (p.partikod === "0003") p.partikod = "0999";
  }
  const result = parse(raw, "final-count");
  assert.equal(result.seatCheck.status, "not-applicable");
  assert.match(result.seatCheck.reason, /additional party/);
  assert.equal(result.national.parties.find(p => p.code === "0999")?.seats, 16);
});

test("reviewed 2026 preparation reconciles geography and eligibility without duplicating predecessor districts", () => {
  const preparation = JSON.parse(readFileSync("data/normalized/election-preparation-2026.json", "utf8"));
  assert.equal(preparation.qualificationDate, "2026-08-14");
  assert.equal(preparation.national.total, 8_046_725);
  assert.equal(preparation.districts.length, 6312); assert.equal(preparation.municipalities.length, 290);
  assert.equal(new Set(preparation.districts.map((d: { code: string }) => d.code)).size, 6312);
  assert.equal(new Set(preparation.registeredRiksdagParties.map((p: { code: string }) => p.code)).size, 168);
  assert.equal(preparation.reportParties.length, 8);
  assert.equal(preparation.districts.filter((d: { comparableTo2022: boolean }) => d.comparableTo2022).length, 5059);
  assert.equal(preparation.districts.filter((d: { previousDistricts: string[] }) => d.previousDistricts.length > 1).length, 35);
  const municipalities = new Set(preparation.municipalities.map((m: { code: string }) => m.code));
  assert.ok(preparation.districts.every((d: { municipality: string; code: string }) => municipalities.has(d.municipality) && d.code.startsWith(d.municipality)));
  assert.equal(preparation.districts.reduce((s: number, d: { eligibleVoters: number }) => s + d.eligibleVoters, 0), preparation.national.total);
  assert.equal(preparation.municipalities.reduce((s: number, m: { total: number }) => s + m.total, 0), preparation.national.total);
});
