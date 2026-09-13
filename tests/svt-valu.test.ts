import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSvtValu, normalizeSvtValu } from "../lib/data/svt-valu";
import manifest from "../data/raw/svt-valu-2026/source-manifest.json";
import source from "../data/raw/svt-valu-2026/mandat.json";
import index from "../data/raw/svt-valu-2026/source-index.json";

test("the Valu snapshot preserves SVT's survey percentages and excludes simulated seats and votes", () => {
  const valu = getSvtValu();
  assert.equal(valu.classification, "POLL");
  assert.equal(valu.electionType, "RD");
  assert.equal(valu.scope, "SE");
  assert.equal(valu.sampleSize, 13709);
  assert.deepEqual(
    Object.fromEntries(valu.parties.map((p) => [p.partyId, p.share])),
    {
      S: 28.4,
      M: 18.06,
      SD: 17.22,
      V: 8.02,
      C: 7.53,
      MP: 7.38,
      KD: 6.06,
      L: 5.36,
      OTHER: 1.96,
    },
  );
  assert.ok(
    valu.parties.every(
      (p) => !Object.hasOwn(p, "votes") && !Object.hasOwn(p, "seats"),
    ),
  );
  // The widget's timestamp is ahead of retrieval. Never display it as a verified publication time.
  assert.equal(valu.retrievedAt, manifest.data.retrievedAt);
  assert.equal(Object.hasOwn(valu, "sourceUpdatedAt"), false);
  for (const entry of [manifest.data, manifest.index]) {
    assert.equal(
      createHash("sha256")
        .update(readFileSync(`data/raw/svt-valu-2026/${entry.file}`))
        .digest("hex"),
      entry.sha256,
    );
  }
});

test("Valu rejects changed source identity, wrong years, missing parties and nonnumeric shares", () => {
  assert.throws(
    () => normalizeSvtValu(source, { prognos: index.valu }),
    /source identity/,
  );
  assert.throws(
    () =>
      normalizeSvtValu(
        { ...source, _meta: { ...source._meta, year: 2022 } },
        index,
      ),
    /election identity/,
  );
  const missing = { ...source } as Record<string, unknown>;
  delete missing.mp;
  assert.throws(() => normalizeSvtValu(missing, index), /party coverage/);
  assert.throws(
    () => normalizeSvtValu({ ...source, ny: { procent: 1 } }, index),
    /party coverage/,
  );
  for (const procent of [null, undefined, "7.38", -1, 101, Infinity, NaN]) {
    assert.throws(
      () =>
        normalizeSvtValu({ ...source, mp: { ...source.mp, procent } }, index),
      /percentage/,
    );
  }
  assert.throws(
    () =>
      normalizeSvtValu({ ...source, mp: { ...source.mp, procent: 7 } }, index),
    /reconcile/,
  );
  assert.throws(
    () =>
      normalizeSvtValu(
        { ...source, _meta: { ...source._meta, ovr_utesluten_pct: null } },
        index,
      ),
    /percentage/,
  );
});

test("rounded survey totals are retained without renormalization; real zero is distinct from missing", () => {
  const zero = {
    ...source,
    mp: { ...source.mp, procent: 0 },
    _meta: { ...source._meta, ovr_utesluten_pct: 9.34 },
  };
  const valu = normalizeSvtValu(zero, index);
  assert.equal(valu.parties.find((p) => p.partyId === "MP")?.share, 0);
  assert.ok(
    Math.abs(valu.parties.reduce((sum, p) => sum + p.share, 0) - 99.99) < 1e-9,
  );
});
