import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { normalizeResult } from "../lib/live/result-adapter";
import { verifySignedJson, digest } from "../lib/live/official-files";
import {
  CERTIFICATE_SHA256,
  LIVE_ADAPTER_VERSION,
} from "../lib/live/constants";
import { normalizeDistricts } from "../lib/nowcast/district-adapter";
import { baseline } from "../lib/nowcast/baseline";

const now = "2026-09-13T18:52:00Z";
const bytes = (name: string) =>
  gunzipSync(
    readFileSync(`tests/fixtures/valmyndigheten-2026/${name}.json.gz`),
  );
const nationalBytes = bytes("production-early");
const districtBytes = bytes("production-districts-early");
const source = {
  adapterVersion: LIVE_ADAPTER_VERSION,
  archiveUrl:
    "https://resultat.val.se/resultatfiler/val2026/p/rd/Val_2026_preliminar_00_RD.zip",
  archiveMd5: "5ca57faa56f34180b99281d68b80512f",
  jsonSha256: digest(nationalBytes),
  certificateSha256: CERTIFICATE_SHA256,
  signatureVerified: true as const,
};
const options = {
  mode: "production" as const,
  stage: "preliminary" as const,
  now,
  source,
};
const result = () =>
  normalizeResult(JSON.parse(nationalBytes.toString()), options);

test("the signed first production snapshot retains eight counted districts alongside unreported areas", () => {
  const certificate = readFileSync(
    "data/raw/valmyndigheten-2026/val-sign-crt.pem",
  );
  for (const [name, data] of [
    ["production-early", nationalBytes],
    ["production-districts-early", districtBytes],
  ] as const) {
    verifySignedJson(
      data,
      readFileSync(`tests/fixtures/valmyndigheten-2026/${name}.sig`),
      certificate,
      now,
    );
  }
  const r = result();
  assert.equal(r.classification, "OFFICIAL");
  assert.equal(r.national.countedDistricts, 8);
  assert.equal(r.national.totalVotes, 3512);
  assert.equal(r.constituencies.length, 29);
  const empty = r.constituencies.find((c) => c.code === "03")!;
  assert.equal(empty.countedDistricts, 0);
  assert.equal(empty.turnoutInCountedDistricts, null);
  assert.deepEqual(empty.parties, []);
  assert.equal(r.seatCheck.status, "not-applicable");
  const normalized = normalizeDistricts(
    JSON.parse(districtBytes.toString()),
    r,
    baseline,
    "production",
    now,
  );
  assert.equal(normalized.observations.filter((d) => d.reported).length, 8);
  assert.equal(normalized.observations.length, r.national.totalDistricts);
  assert.ok(
    normalized.observations
      .filter((d) => !d.reported)
      .every((d) => Object.values(d.votes).every((v) => v === 0)),
  );
});

test("a null distribution cannot hide counted votes, turnout, mandates or a reported district", () => {
  for (const mutation of [
    { antalValdistriktRaknade: 1 },
    { totaltAntalRoster: 1 },
    { antalRostberattigadeIRaknadeValdistrikt: 1 },
    { valdeltagande: 1 },
    { mandatfordelning: { partiLista: [] } },
  ]) {
    const input = JSON.parse(nationalBytes.toString());
    Object.assign(
      input.valomrade.valkretsLista.find(
        (c: { kod: string }) => c.kod === "03",
      ),
      mutation,
    );
    assert.throws(() => normalizeResult(input, options));
  }
  const input = JSON.parse(districtBytes.toString());
  input.valdistrikt.find(
    (d: { rostfordelning: unknown }) => d.rostfordelning === null,
  ).rapporteringsTid = "2026-09-13T20:49:00";
  assert.throws(
    () => normalizeDistricts(input, result(), baseline, "production", now),
    /Missing distribution/,
  );
});
