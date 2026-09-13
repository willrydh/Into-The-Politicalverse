import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import JSZip from "jszip";
import { projectVotes } from "../lib/nowcast/model";
import { baseline, baselineSha256 } from "../lib/nowcast/baseline";
import { normalizeDistricts } from "../lib/nowcast/district-adapter";
import { roundedVotes } from "../lib/nowcast/pipeline";
import { publicNowcast } from "../lib/nowcast/public";
import {
  NOWCAST_PARTIES,
  NOWCAST_VERSION,
  type BaselineUnit,
  type Observation,
  type Votes,
} from "../lib/nowcast/types";
import { emptyFeed, collectLiveData } from "../lib/live/collector";
import {
  digest,
  readSignedArchive,
  INDEX_URLS,
} from "../lib/live/official-files";
import { EARLY_VOTING_URL } from "../lib/live/early-voting";
import {
  CERTIFICATE_SHA256,
  LIVE_ADAPTER_VERSION,
} from "../lib/live/constants";
import type { LiveResult, LiveArea } from "../lib/live/types";
import stress from "../data/normalized/election-nowcast-stress.json";
const votes = (s: number, m: number): Votes =>
  ({
    ...Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0])),
    S: s,
    M: m,
  }) as Votes;

test("an empty result source refreshes a previously published waiting model version and check time", async () => {
  const previous = emptyFeed("production", "2026-09-13T16:00:00.000Z");
  previous.nowcast = {methodVersion:"pv-nowcast-1.0.0",status:"waiting",checkedAt:previous.checkedAt};
  const now = "2026-09-13T16:50:00.000Z";
  const result = await collectLiveData(previous, {mode:"production",now,certificate:Buffer.alloc(0), nowcast:async()=>{throw new Error("No result archive should be modeled yet");}, fetchFile:async(url)=>url===INDEX_URLS.production ? readFileSync("tests/fixtures/valmyndigheten-2026/production-empty-index.md5") : null});
  assert.deepEqual(result.feed.nowcast,{methodVersion:NOWCAST_VERSION,status:"waiting",checkedAt:now});
  assert.equal(result.feed.stageStatus.preliminary,"awaiting-results");
  assert.deepEqual(result.nowcastWarnings,[]);
  assert.equal(previous.nowcast.methodVersion,"pv-nowcast-1.0.0");
});
const unit = (
  code: string,
  s: number,
  m: number,
  collection = false,
): BaselineUnit => ({
  code,
  municipality: code.slice(0, 4),
  constituency: "01",
  eligible: collection ? 0 : 100,
  baselineEligible: collection ? 0 : 100,
  votes: votes(s, m),
  matched: !collection,
  collection,
});
const observe = (b: BaselineUnit, v: Votes, reported = true): Observation => ({
  code: b.code,
  municipality: b.municipality,
  constituency: b.constituency,
  eligible: b.collection ? null : b.eligible,
  votes: v,
  reported,
  collection: b.collection,
});

test("matched changes remove composition bias and estimates converge exactly to counted votes", () => {
  const units = [unit("01010101", 80, 20), unit("01010102", 20, 80)];
  const first = projectVotes(units, [
    observe(units[0], votes(80, 20)),
    observe(units[1], votes(0, 0), false),
  ]).estimate;
  assert.equal(first.rows.find((p) => p.partyId === "S")!.countedShare, 80);
  assert.equal(first.rows.find((p) => p.partyId === "S")!.projectedShare, 50);
  assert.equal(first.status, "insufficient");
  const full = projectVotes(
    units,
    units.map((b) => observe(b, b.votes)),
  ).estimate;
  assert.equal(full.estimatedRemainingVotes, 0);
  assert.equal(full.status, "counted");
  assert.ok(
    full.rows.every(
      (p) =>
        p.projectedVotes === p.countedVotes &&
        p.sensitivity[0] === p.projectedShare &&
        p.sensitivity[1] === p.projectedShare,
    ),
  );
});

test("turnout volume, swing, changed boundaries and collection ballots remain distinct", () => {
  const units = [
    unit("01010101", 40, 40),
    unit("01010102", 40, 40),
    unit("0101-collection", 10, 10, true),
  ];
  units[1].matched = false;
  const out = projectVotes(units, [
    observe(units[0], votes(30, 10)),
    observe(units[1], votes(0, 0), false),
  ]).estimate;
  assert.equal(out.matchedDistricts, 1);
  assert.equal(out.estimatedRemainingVotes, 50);
  assert.equal(out.estimatedCollectionVotes, 10);
  assert.equal(out.rows.find((p) => p.partyId === "S")!.projectedVotes, 67.5);
  assert.equal(
    out.rows.reduce((s, p) => s + p.projectedVotes, 0),
    90,
  );
  // One of two collection districts is counted; no double counting of its votes.
  const collections = [
    observe({ ...units[2], code: "01019901" }, votes(3, 2)),
    observe({ ...units[2], code: "01019902" }, votes(0, 0), false),
  ];
  const partial = projectVotes(units, [
    observe(units[0], votes(30, 10)),
    observe(units[1], votes(0, 0), false),
    ...collections,
  ]).estimate;
  assert.equal(partial.countedVotes, 45);
  assert.equal(partial.estimatedCollectionVotes, 5);
  const complete = projectVotes(units, [
    ...units.slice(0, 2).map((u) => observe(u, u.votes)),
    ...collections.map((c) => ({ ...c, reported: true, votes: votes(3, 2) })),
  ]).estimate;
  assert.equal(complete.estimatedRemainingVotes, 0);
  assert.equal(complete.countedVotes, 170);
});

test("nonnegative simplex, stable corrections and duplicate/missing geography guards", () => {
  const units = [unit("01010101", 1, 99), unit("01010102", 99, 1)];
  const obs = [
    observe(units[0], votes(100, 0)),
    observe(units[1], votes(0, 0), false),
  ];
  const e = projectVotes(units, obs).estimate;
  assert.ok(e.rows.every((r) => r.projectedVotes >= 0));
  assert.ok(
    Math.abs(e.rows.reduce((s, r) => s + r.projectedShare, 0) - 100) < 1e-8,
  );
  const corrected = projectVotes(units, [
    { ...obs[0], votes: votes(90, 0) },
    obs[1],
  ]).estimate;
  assert.equal(corrected.countedVotes, 90);
  assert.notDeepEqual(corrected, e);
  assert.throws(() => projectVotes(units, [obs[0], obs[0]]), /Duplicate/);
  assert.throws(
    () => projectVotes(units, [{ ...obs[0], code: "unknown" }]),
    /Unmapped/,
  );
  assert.throws(
    () => projectVotes(units, [{ ...obs[0], reported: false }]),
    /Unreported/,
  );
  const r = roundedVotes({ ...votes(2.6, 2.6), OTHER: 0.8 });
  assert.equal(
    Object.values(r).reduce((a, b) => a + b, 0),
    6,
  );
  assert.ok(Object.values(r).every(Number.isInteger));
});

test("publication needs broad geographic support and sufficient comparable exposure", () => {
  const units = Array.from({ length: 1000 }, (_, i) => ({
    ...unit(String(i).padStart(8, "0"), 40, 40),
    municipality: String(i).padStart(4, "0"),
    constituency: String(i % 10).padStart(2, "0"),
  }));
  const observed = units.map((u, i) =>
    observe(u, i < 100 ? u.votes : votes(0, 0), i < 100),
  );
  assert.equal(projectVotes(units, observed).estimate.status, "experimental");
  assert.equal(
    projectVotes(
      units,
      observed.map((o) => ({ ...o, constituency: "01" })),
    ).estimate.status,
    "insufficient",
  );
  assert.equal(
    projectVotes(
      units,
      observed.map((o, i) => ({
        ...o,
        reported: i < 20,
        votes: i < 20 ? o.votes : votes(0, 0),
      })),
    ).estimate.status,
    "insufficient",
  );
});

test("reviewed baseline covers every 2026 physical district, with collection votes separate", () => {
  assert.equal(baseline.filter((d) => !d.collection).length, 6312);
  assert.equal(baseline.filter((d) => d.collection).length, 290);
  assert.equal(
    baseline.filter((d) => !d.collection).reduce((s, d) => s + d.eligible, 0),
    8046725,
  );
  assert.ok(
    baseline.every((d) =>
      NOWCAST_PARTIES.every(
        (p) => Number.isFinite(d.votes[p]) && d.votes[p] >= 0,
      ),
    ),
  );
  assert.match(baselineSha256, /^[a-f0-9]{64}$/);
  assert.equal(stress.districts, 4162);
  assert.equal(stress.methodVersion, NOWCAST_VERSION);
  assert.ok(stress.checkpoints.every((c) => c.modelMae <= c.rawMae));
  assert.equal(stress.checkpoints.at(-1)!.modelMae, 0);
});

// Fabricated schema examples for invariant tests, never production inputs.
function schemaExample() {
  const b = unit("01010101", 40, 40);
  const now = "2026-09-13T20:00:00Z";
  const d = {
    namn: "Synthetic test district",
    valdistriktstyp: "Valdistrikt",
    rapporteringsTid: "2026-09-13T21:59:00",
    valdistriktskod: b.code,
    kommunkod: b.municipality,
    kretskod: "01",
    antalRostberattigade: 100,
    totaltAntalRoster: 82,
    rostfordelning: {
      rosterPaverkaMandat: {
        antalRoster: 80,
        partiRoster: [
          { partikod: "0002", antalRoster: 40, andelRoster: 50 },
          { partikod: "0001", antalRoster: 40, andelRoster: 50 },
        ],
        rosterOvrigaPartier: { antalRoster: 0 },
      },
      rosterEjPaverkaMandat: { antalRoster: 2 },
    },
  };
  const raw = {
    valtillfalle: "Val_2026",
    valklass: "ordinarie val",
    valtyp: "RD",
    valdatum: "2026-09-13",
    rakningstillfalle: "preliminär",
    senasteUppdateringstid: "2026-09-13T22:00:00",
    antalUppdateringar: 1,
    antalValdistriktRaknade: 1,
    antalValdistriktSomSkaRaknas: 1,
    valdistrikt: [d],
  };
  const a: LiveArea = {
    code: "01",
    name: "Synthetic area",
    countedDistricts: 1,
    totalDistricts: 1,
    validVotes: 80,
    invalidVotes: 2,
    totalVotes: 82,
    eligibleVoters: 100,
    eligibleInCountedDistricts: 100,
    turnoutInCountedDistricts: 82,
    otherVotes: 0,
    fixedSeats: 1,
    parties: d.rostfordelning.rosterPaverkaMandat.partiRoster.map((p) => ({
      code: p.partikod,
      name: p.partikod,
      abbreviation: "",
      votes: p.antalRoster,
      share: 50,
      seats: null,
      fixedSeats: null,
      adjustmentSeats: null,
    })),
  };
  const result: LiveResult = {
    electionDate: "2026-09-13",
    classification: "OFFICIAL",
    stage: "preliminary",
    sourceUpdatedAt: now,
    sourceRevision: 1,
    national: { ...a, code: "00" },
    constituencies: [a],
    protocolUrl: null,
    seatCheck: {
      status: "not-applicable",
      reason: "Synthetic example",
      tieCount: 0,
    },
    source: {
      adapterVersion: LIVE_ADAPTER_VERSION,
      archiveMd5: "a".repeat(32),
      archiveUrl:
        "https://resultat.val.se/resultatfiler/val2026/p/rd/Val_2026_preliminar_00_RD.zip",
      jsonSha256: "b".repeat(64),
      certificateSha256: CERTIFICATE_SHA256,
      signatureVerified: true,
    },
  };
  return { b, raw, result, now };
}
test("district adapter rejects mismatched totals, timing, missing rows, duplicates and test data", () => {
  const { b, raw, result, now } = schemaExample();
  assert.equal(
    normalizeDistricts(raw, result, [b], "production", now).observations[0]
      .reported,
    true,
  );
  assert.throws(
    () =>
      normalizeDistricts(
        { ...raw, test: true },
        result,
        [b],
        "production",
        now,
      ),
    /test identity/,
  );
  assert.throws(
    () =>
      normalizeDistricts(
        { ...raw, antalValdistriktRaknade: 0 },
        result,
        [b],
        "production",
        now,
      ),
    /disagree/,
  );
  assert.throws(
    () =>
      normalizeDistricts(
        { ...raw, valdistrikt: [] },
        result,
        [b],
        "production",
        now,
      ),
    /coverage/,
  );
  assert.throws(
    () =>
      normalizeDistricts(
        { ...raw, valdistrikt: [...raw.valdistrikt, ...raw.valdistrikt] },
        result,
        [b],
        "production",
        now,
      ),
    /Duplicate/,
  );
  const broken = structuredClone(raw);
  broken.valdistrikt[0].rapporteringsTid = "";
  assert.throws(
    () => normalizeDistricts(broken, result, [b], "production", now),
    /Unreported/,
  );
  const wrong = structuredClone(result);
  wrong.constituencies[0].parties[0].votes--;
  assert.throws(
    () => normalizeDistricts(raw, wrong, [b], "production", now),
    /party files/,
  );
});

test("optional model failures do not quarantine signed official votes, and district signatures are mandatory", async () => {
  const now = "2026-09-06T15:00:00Z",
    certificate = readFileSync("data/raw/valmyndigheten-2026/val-sign-crt.pem");
  const raw = gunzipSync(
    readFileSync("tests/fixtures/valmyndigheten-2026/preliminar.json.gz"),
  );
  const sig = readFileSync("tests/fixtures/valmyndigheten-2026/preliminar.sig");
  const zip = new JSZip();
  zip.file("Genrep_2026_preliminar_mandatfordelning_00_RD.json", raw);
  zip.file("Genrep_2026_preliminar_mandatfordelning_00_RD_sign.sha256", sig);
  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  const md5 = digest(archive, "md5");
  const index = Buffer.from(`${md5} ./p/rd/Genrep_2026_preliminar_00_RD.zip`);
  const previous = emptyFeed("rehearsal", now);
  const options = {
    mode: "rehearsal" as const,
    now,
    certificate,
    fetchFile: async (url: string) =>
      url === INDEX_URLS.rehearsal
        ? index
        : url === EARLY_VOTING_URL
          ? null
          : archive,
    nowcast: async () => {
      throw new Error("District file unavailable");
    },
  };
  const out = await collectLiveData(previous, options);
  assert.equal(out.feed.stageStatus.preliminary, "ok");
  assert.equal(out.feed.resultStatus, "ok");
  assert.equal(out.feed.nowcast?.status, "error");
  assert.match(out.nowcastWarnings[0], /District file/);
  assert.equal(
    out.feed.results.preliminary?.national.validVotes,
    JSON.parse(raw.toString()).valomrade.rostfordelning.rosterPaverkaMandat
      .antalRoster,
  );
  const retried = await collectLiveData(out.feed, {
    ...options,
    fetchFile: async (url: string) => {
      if (url === INDEX_URLS.rehearsal) return index;
      throw new Error("Model-only download failed");
    },
  });
  assert.equal(retried.feed.stageStatus.preliminary, "ok");
  assert.equal(retried.feed.nowcast?.status, "error");
  assert.deepEqual(
    retried.feed.results.preliminary,
    out.feed.results.preliminary,
  );
  await assert.rejects(
    readSignedArchive(
      archive,
      { url: "test", md5 },
      {
        mode: "rehearsal",
        now,
        certificate,
        stage: "preliminary",
        kind: "rostfordelning",
      },
    ),
    /Expected one/,
  );
  zip.file("Genrep_2026_preliminar_rostfordelning_00_RD.json", "{}");
  zip.file("Genrep_2026_preliminar_rostfordelning_00_RD_sign.sha256", sig);
  const bad = await zip.generateAsync({ type: "nodebuffer" });
  await assert.rejects(
    readSignedArchive(
      bad,
      { url: "test", md5: digest(bad, "md5") },
      {
        mode: "rehearsal",
        now,
        certificate,
        stage: "preliminary",
        kind: "rostfordelning",
      },
    ),
    /signature/,
  );
});

test("public model validation isolates stale, malformed and prematurely exposed projections", () => {
  const { b, result, now } = schemaExample();
  const feed = emptyFeed("production", now);
  feed.results.preliminary = result;
  feed.stageStatus.preliminary = "ok";
  const estimate = projectVotes([b], [observe(b, b.votes)]).estimate;
  feed.nowcast = {
    methodVersion: NOWCAST_VERSION,
    status: "ready",
    checkedAt: now,
    source: {
      archiveMd5: result.source.archiveMd5,
      jsonSha256: "b".repeat(64),
      revision: 1,
      updatedAt: now,
      baselineSha256,
    },
    estimate,
  };
  assert.ok(publicNowcast(feed));
  const mismatch = structuredClone(feed);
  mismatch.nowcast!.source!.archiveMd5 = "c".repeat(32);
  assert.equal(publicNowcast(mismatch), null);
  const corrupt = structuredClone(feed);
  corrupt.nowcast!.estimate!.rows[0].projectedShare = 99;
  assert.equal(publicNowcast(corrupt), null);
  const early = structuredClone(feed);
  early.nowcast!.estimate!.status = "insufficient";
  assert.equal(publicNowcast(early), null);
  early.nowcast!.estimate!.rows = [];
  assert.ok(publicNowcast(early));
  feed.stageStatus.preliminary = "error";
  assert.equal(publicNowcast(feed), null);
});
