import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { readXlsxWorkbook } from "../lib/data/valmyndigheten/xlsx";
import { VALMYNDIGHETEN_PARTY_NAMES } from "../lib/data/elections/parties";
import { aggregatePersonalVotes, type PersonalVoteRow, type PersonalVoteData } from "../lib/data/geography/personal-votes";

const root = resolve(import.meta.dirname, ".."); const dir = join(root, "data/raw/downloads/local-geography");
const manifestPath = join(root, "data/raw/valmyndigheten/personal-votes-source-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const resultManifest = JSON.parse(await readFile(join(root, "data/raw/valmyndigheten/source-manifest.json"), "utf8"));
const sha = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
await mkdir(dir, { recursive: true });
async function source(file: string, url: string, checksum: string) {
  const path = join(dir, file);
  if (!existsSync(path)) { const response = await fetch(url); if (!response.ok) throw new Error(`Source error ${response.status}`); await writeFile(path, Buffer.from(await response.arrayBuffer())); }
  assert.equal(sha(await readFile(path)), checksum, `Source checksum ${file}`); return path;
}
const path = await source("personal2022.xlsx", manifest.sourceUrl, manifest.sourceSha256);
const votesPath = await source("rd2022.xlsx", resultManifest.election2022.url, resultManifest.election2022.sha256);
const workbook = await readXlsxWorkbook(path); const sheet = workbook.getWorksheet("Rådata"); assert.ok(sheet);
const expected = ["Valtyp", "Länskod", "Län", "Kommunkod", "Län/Kommun", "Kommun", "Valkretskod", "Valkretsnamn", "Partikod", "Partikod II", "Parti", "Listnummer", "Ordning", "Kandidatnr", "Förnamn", "Efternamn", "Namn", "Namn och kod", "Antal personröster"];
assert.deepEqual(expected.map((_, i) => sheet.getRow(1).getCell(i + 1).text.trim()), expected);
const rows: PersonalVoteRow[] = [];
sheet.eachRow((row, i) => {
  const cell = (j: number) => row.getCell(j).text.trim();
  if (i === 1 || cell(1) !== "RD") return;
  assert.equal(cell(5), "0000", "RD personal source must remain constituency-level");
  assert.match(cell(19), /^\d+$/); const name = cell(11);
  rows.push({ constituency: cell(7), partyCode: cell(9), partyId: VALMYNDIGHETEN_PARTY_NAMES[name] ?? "OTHER", partyName: name, candidateId: cell(14), name: cell(17), list: cell(12), position: cell(13), votes: Number(cell(19)) });
});
assert.equal(rows.length, 14172); assert.equal(rows.reduce((sum, r) => sum + r.votes, 0), 1457836);
const partyNames = new Set(rows.map(r => r.partyName)); const denominators = new Map<string, number>();
const votesWorkbook = await readXlsxWorkbook(votesPath); const votesSheet = votesWorkbook.getWorksheet("roster_RD"); assert.ok(votesSheet);
assert.equal(votesSheet.getRow(1).getCell(8).text.trim(), "Valkretskod"); assert.equal(votesSheet.getRow(1).getCell(10).text.trim(), "Parti"); assert.equal(votesSheet.getRow(1).getCell(11).text.trim(), "Röster");
votesSheet.eachRow((row, i) => {
  if (i === 1) return; assert.equal(row.getCell(1).text.trim(), "RD");
  const name = row.getCell(10).text.trim(); if (!partyNames.has(name)) return;
  const key = `${row.getCell(8).text.trim()}:${name}`; const votes = Number(row.getCell(11).text.trim()); assert.ok(Number.isSafeInteger(votes) && votes >= 0);
  denominators.set(key, (denominators.get(key) ?? 0) + votes);
});
const current = JSON.parse(await readFile(join(root, "data/normalized/riksdag-2022.json"), "utf8"));
const constituencies = aggregatePersonalVotes(rows, denominators, current.constituencies.map((a: { code: string; name: string }) => ({ code: a.code, name: a.name })));
assert.equal(constituencies.length, 29); assert.equal(constituencies.flatMap(c => c.candidates).length, 13775);
assert.equal(constituencies.flatMap(c => c.candidates).reduce((sum, c) => sum + c.votes, 0), 1457836);
const output: PersonalVoteData = { schemaVersion: 1, electionType: "RD", year: 2022, level: "constituency", status: "final", source: { publisher: "Valmyndigheten", sourceUrl: manifest.sourceUrl, sourceSha256: manifest.sourceSha256, retrievedAt: manifest.retrievedAt, votesSourceUrl: resultManifest.election2022.url, votesSourceSha256: resultManifest.election2022.sha256, methodVersion: "personal-votes-1.0.0" }, constituencies };
const destination = "data/normalized/personal-votes-2022.json"; const bytes = JSON.stringify(output) + "\n";
if (manifest.outputs[destination]) assert.equal(sha(bytes), manifest.outputs[destination]);
await writeFile(join(root, destination), bytes); manifest.outputs[destination] = sha(bytes); manifest.expected = { sourceRows: rows.length, candidacies: 13775, personalVotes: 1457836, constituencies: 29 };
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("Verified 1,457,836 personal votes across 29 constituencies and 13,775 candidate/party/constituency combinations; multiple ballot lists summed.");
