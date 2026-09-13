import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import JSZip from "jszip";
import { parseLocalDistricts2018 } from "../lib/data/valmyndigheten/local-results";
import { readXlsxWorkbook } from "../lib/data/valmyndigheten/xlsx";

import index from "../data/normalized/local-election-index.json";
import { NOWCAST_PARTIES, type Votes } from "../lib/nowcast/types";
import { history } from "../lib/nowcast/baseline";

const dir = "data/raw/downloads/nowcast-v2/";
const sources = [
  {
    file: "rd2014-districts.skv",
    url: "https://historik.val.se/val/val2014/statistik/2014_riksdagsval_per_valdistrikt.skv",
    sha256: "81ccc73c581a6c9cc4b2233822da835c63b796db6bbfbaf6bafbf306516c44a6",
  },
  {
    file: "mapping-2014-2018.zip",
    url: "https://historik.val.se/val/val2018/statistik/mappning_2014_2018.zip",
    sha256: "a4dbda55390005d1cba3aec71a9f1d64ce8daf458c98ce2adf182c780637a16b",
  },
  {
    file: "preliminary-2022.xlsx",
    url: "https://www.val.se/download/18.162047b519a91d05331197bf/1663915218435/preliminart-roster-per-distrikt-riksdagsvalet-2022.xlsx",
    sha256: "21951949ae6c122dd8c1fe7f8a3292dd982a04eb5abba0334ba984a309bd42e7",
  },
  {
    file: "rd2018-districts.xlsx",
    url: "https://historik.val.se/val/val2018/statistik/2018_R_per_valdistrikt.xlsx",
    sha256: "dc344784743cb546b4d8b3a80048985512f32d14319ffb01ef1dde84afe5c29b",
  },
];
const sha = (b: Buffer | string) =>
  createHash("sha256").update(b).digest("hex");
await mkdir(dir, { recursive: true });
for (const s of sources) {
  if (!existsSync(dir + s.file)) {
    const response = await fetch(s.url, { signal: AbortSignal.timeout(60000) });
    assert.ok(response.ok, `Source unavailable: ${s.file}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(sha(bytes), s.sha256, `Source changed: ${s.file}`);
    await writeFile(dir + s.file, bytes);
  }
  assert.equal(sha(await readFile(dir + s.file)), s.sha256);
}
const old2018 = dir + "rd2018-districts.xlsx";
assert.equal(
  sha(await readFile(old2018)),
  "dc344784743cb546b4d8b3a80048985512f32d14319ffb01ef1dde84afe5c29b",
);
const blank = () =>
  Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0])) as Votes;
const num = (s: string) => {
  assert.match(s.trim(), /^\d+$/);
  assert.ok(Number.isSafeInteger(Number(s)));
  return Number(s.trim());
};
const sum = (v: Votes) => NOWCAST_PARTIES.reduce((s, p) => s + v[p], 0);
const lines = new TextDecoder("windows-1252")
  .decode(await readFile(dir + sources[0].file))
  .trim()
  .split(/\r?\n/);
const header = lines.shift()!.split(";");
const old = new Map<
  string,
  { eligible: number; votes: Votes; municipality: string }
>();
const total2014 = blank(),
  municipal2014 = new Map<string, Votes>();
for (const line of lines) {
  const cells = line.split(";");
  assert.equal(cells.length, header.length);
  const get = (key: string) => cells[header.indexOf(key)].trim();
  const municipality =
    get("LAN").padStart(2, "0") + get("KOM").padStart(2, "0");
  const v = blank();
  for (const p of NOWCAST_PARTIES.filter((p) => p !== "OTHER"))
    v[p] = num(get(`${p === "L" ? "FP" : p} tal`));
  v.OTHER = num(get("Rost Giltiga")) - sum(v);
  assert.ok(v.OTHER >= 0);
  const m = municipal2014.get(municipality) ?? blank();
  for (const p of NOWCAST_PARTIES) {
    total2014[p] += v[p];
    m[p] += v[p];
  }
  municipal2014.set(municipality, m);
  if (get("VALDIST").length !== 4) continue;
  const code = municipality + get("VALDIST");
  assert.ok(!old.has(code));
  old.set(code, { eligible: num(get("Rostb")), votes: v, municipality });
}
assert.deepEqual(
  total2014,
  index.national.results.find((r) => r.year === 2014)!.votes,
);
for (const m of index.municipalities)
  assert.deepEqual(
    municipal2014.get(m.code),
    m.results.find((r) => r.year === 2014)!.votes,
  );
const zip = await JSZip.loadAsync(await readFile(dir + sources[1].file));
const mappingRows = (await zip.file("vd-mappning-2014-2018.skv")!.async("text"))
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((s) => s.split(";"));
const flags = new Map(
  (await zip.file("vd-indelning-2018.skv")!.async("text"))
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((s) => s.split(";") as [string, string]),
);
const targets = new Map<string, string[]>(),
  uses = new Map<string, number>(),
  percentages = new Map<string, number>();
for (const [from, to, percent] of mappingRows) {
  percentages.set(`${from}:${to}`, Number(percent));
  uses.set(from, (uses.get(from) ?? 0) + 1);
  targets.set(to, [...(targets.get(to) ?? []), from]);
}
const current2018 = await parseLocalDistricts2018(old2018);
for (const m of index.municipalities) {
  const observed = blank();
  for (const row of current2018.filter((r) => r.parent === m.code))
    for (const p of NOWCAST_PARTIES) observed[p] += row.results[0].votes[p];
  assert.deepEqual(observed, m.results.find((r) => r.year === 2018)!.votes);
}
const units2018 = [];
for (const row of current2018.filter((r) => r.level === "district")) {
  const priorCodes = targets.get(row.code);
  if (
    !["O", "S"].includes(flags.get(row.code) ?? "") ||
    !priorCodes?.length ||
    priorCodes.some(
      (c) => uses.get(c) !== 1 || percentages.get(`${c}:${row.code}`) !== 100,
    )
  )
    continue;
  const previous = priorCodes.map((c) => old.get(c));
  assert.ok(previous.every(Boolean));
  assert.ok(previous.every((p) => p!.municipality === row.parent));
  const votes = blank();
  let baselineEligible = 0;
  for (const p of previous) {
    baselineEligible += p!.eligible;
    for (const party of NOWCAST_PARTIES) votes[party] += p!.votes[party];
  }
  const current = row.results[0],
    m = index.municipalities.find((m) => m.code === row.parent)!;
  assert.equal(m.constituencies.length, 1);
  units2018.push({
    code: row.code,
    municipality: row.parent!,
    constituency: m.constituencies[0],
    eligible: current.eligibleVoters,
    baselineEligible,
    votes,
    matched: true,
    collection: false,
    actual: current.votes,
  });
}
assert.ok(units2018.length > 3000);

// The official workbook is the completed preliminary count. It contains no
// reporting timestamps: its row order must never be treated as election time.
const wb = await readXlsxWorkbook(dir + sources[2].file);
const sheet = wb.getWorksheet("Blad1");
assert.ok(sheet);
const cols = new Map<string, number>();
sheet.getRow(1).eachCell((c, i) => cols.set(c.text.trim(), i));
for (const k of ["Distrikt", "Parti", "Röster", "Röstberättigade"])
  assert.ok(cols.has(k));
const preliminaryParties: Record<string, keyof Votes> = {
  Moderaterna: "M",
  Centerpartiet: "C",
  Liberalerna: "L",
  Kristdemokraterna: "KD",
  Socialdemokraterna: "S",
  Vänsterpartiet: "V",
  Miljöpartiet: "MP",
  Sverigedemokraterna: "SD",
  "Övriga anmälda partier": "OTHER",
};
const preliminary = new Map<
    string,
    {
      votes: Votes;
      valid: number;
      eligible: number | null;
      unregistered: number;
    }
  >(),
  seen = new Set<string>();
for (let row = 2; row <= sheet.rowCount; row++) {
  const get = (k: string) =>
    sheet.getRow(row).getCell(cols.get(k)!).text.trim();
  const code = get("Distrikt").replace(/^RD-/, "").replaceAll("-", "");
  assert.match(code, /^\d{8}$/);
  const d = preliminary.get(code) ?? {
      votes: blank(),
      valid: 0,
      eligible: null,
      unregistered: 0,
    },
    name = get("Parti"),
    party = preliminaryParties[name],
    n = num(get("Röster"));
  assert.ok(!seen.has(`${code}:${name}`), "Duplicate preliminary row");
  seen.add(`${code}:${name}`);
  if (get("Röstberättigade") && get("Röstberättigade") !== "#N/A") {
    const eligible = num(get("Röstberättigade"));
    assert.ok(d.eligible === null || d.eligible === eligible);
    d.eligible = eligible;
  }
  if (party) d.votes[party] = n;
  else if (name === "Summa giltiga röster") d.valid = n;
  else if (name === "Ogiltiga röster - ej anmälda partier") d.unregistered = n;
  preliminary.set(code, d);
}
for (const [code, d] of preliminary) {
  assert.ok(
    seen.has(`${code}:Summa giltiga röster`) &&
      seen.has(`${code}:Valdeltagande`),
  );
  for (const name of Object.keys(preliminaryParties))
    assert.ok(seen.has(`${code}:${name}`), `Missing party ${name}`);
  // This preliminary export includes unregistered-party ballots in its
  // published "Summa giltiga" denominator. Preserve that denominator, placing
  // all unnamed ballots in OTHER, and verify the exact accounting identity.
  assert.equal(sum(d.votes) + d.unregistered, d.valid);
  d.votes.OTHER += d.unregistered;
}
const units2022 = history
  .filter(
    (d) => d.level === "district" && d.results.some((r) => r.year === 2018),
  )
  .map((d) => {
    const b = d.results.find((r) => r.year === 2018)!,
      a = d.results.find((r) => r.year === 2022)!,
      pre = preliminary.get(d.code);
    assert.ok(pre && pre.valid > 0);
    if (pre.eligible !== null) assert.equal(pre.eligible, a.eligibleVoters);
    return {
      code: d.code,
      municipality: d.parent,
      constituency: d.constituencies[0],
      eligible: a.eligibleVoters,
      baselineEligible: b.eligibleVoters,
      votes: b.votes,
      matched: true,
      collection: false,
      actual: pre.votes,
      final: a.votes,
    };
  });
const dependencies = await Promise.all(
  [
    "data/normalized/local-election-index.json",
    "data/normalized/local-election-districts.json",
  ].map(async (path) => ({ path, sha256: sha(await readFile(path)) })),
);
const output = {
  schemaVersion: 1,
  dependencies,
  sources,
  scope:
    "Official comparable physical districts only. 2018 final-count observations; 2022 completed preliminary observations and separate final outcomes. Electoral-roll sizes are from the official final workbooks; the preliminary workbook has 6067 missing roll entries. Synthetic reporting orders; no original reporting times.",
  elections: [
    { year: 2018, baselineYear: 2014, units: units2018 },
    { year: 2022, baselineYear: 2018, units: units2022 },
  ],
};
const serialized = JSON.stringify(output) + "\n",
  outputPath = "data/normalized/nowcast-evaluation-history.json";
await writeFile(outputPath, serialized);
await writeFile(
  "data/raw/valmyndigheten-2026/nowcast-evaluation-manifest.json",
  JSON.stringify(
    {
      retrievedAt: "2026-09-13",
      publisher: "Valmyndigheten",
      sources: output.sources,
      dependencies,
      output: { path: outputPath, sha256: sha(serialized) },
      counts: output.elections.map((e) => ({
        year: e.year,
        districts: e.units.length,
      })),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  output.elections.map((e) => ({ year: e.year, districts: e.units.length })),
);
