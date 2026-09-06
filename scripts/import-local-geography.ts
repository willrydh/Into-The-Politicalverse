import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, basename } from "node:path";
import JSZip from "jszip";
import { PARTY_IDS, type AreaResult } from "../lib/data/elections/types";
import { LOCAL_YEARS, type LocalObservation, type LocalArea, type LocalSources } from "../lib/data/geography/local-types";
import { sumObservations } from "../lib/data/geography/local-math";
import { projectLocalMap, type LocalGeometry } from "../lib/data/geography/local-projection";
import { parseLocalMunicipalityCsv, parseLocalDistricts2018, parseLocalDistricts2022, parseDistrictComparison } from "../lib/data/valmyndigheten/local-results";

const root = resolve(import.meta.dirname, "..");
const dir = join(root, "data/raw/downloads/local-geography");
const manifestPath = join(root, "data/raw/valmyndigheten/local-geography-source-manifest.json");
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const json = async (path: string) => JSON.parse(await readFile(join(root, path), "utf8"));
const manifest = await json("data/raw/valmyndigheten/local-geography-source-manifest.json");
await mkdir(dir, { recursive: true });
async function source(file: string, url: string, checksum: string): Promise<string> {
  const path = join(dir, file); await mkdir(resolve(path, ".."), { recursive: true });
  if (!existsSync(path)) {
    const response = await fetch(url); if (!response.ok) throw new Error(`Source download failed: ${url}: ${response.status}`);
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
  }
  assert.equal(sha(await readFile(path)), checksum, `Source checksum ${file}`); return path;
}
for (const s of manifest.sources) await source(s.file, s.url, s.sha256);
const metadata: LocalSources = { publisher: "Valmyndigheten", retrievedAt: manifest.retrievedAt, methodVersion: "local-geography-1.0.0", sources: manifest.sources };
const previousMunicipalities = await json("data/normalized/riksdag-municipalities-2018.json");
const current = await json("data/normalized/riksdag-2022.json");
const history = await json("data/normalized/riksdag-national-history.json");
const geometryManifest = await json("data/raw/valmyndigheten/geography-source-manifest.json");
function fromArea(area: AreaResult, year: LocalObservation["year"]): LocalObservation {
  return { year, validVotes: area.validVotes, totalVotes: area.totalVotes, eligibleVoters: area.eligibleVoters, votes: Object.fromEntries(area.parties.map(p => [p.partyId, p.votes])) as LocalObservation["votes"] };
}
function sameCounts(actual: LocalObservation, expected: LocalObservation, name: string) { assert.deepEqual(actual, expected, `Official totals for ${name}`); }
const municipalities: LocalArea[] = current.municipalities.map((a: AreaResult) => ({ code: a.code, name: a.name, level: "municipality", parent: a.code.slice(0, 2), results: [fromArea(a, 2022)] }));
for (const area of municipalities) {
  const previous = previousMunicipalities.municipalities.find((a: AreaResult) => a.code === area.code && a.name === area.name);
  assert.ok(previous, `2018 municipality join ${area.code}`); area.results.unshift(fromArea(previous, 2018));
}
for (const year of [2010, 2014] as const) {
  const parsed = parseLocalMunicipalityCsv(new TextDecoder("windows-1252").decode(await readFile(join(dir, `rd${year}.skv`))), year);
  assert.equal(parsed.length, 290);
  for (const row of parsed) {
    const area = municipalities.find(a => a.code === row.code && a.name === row.name);
    assert.ok(area, `Historical municipality join ${row.code} ${row.name}`); area.results.push(row.results[0]);
  }
}
for (const area of municipalities) area.results.sort((a, b) => a.year - b.year);
const national: LocalArea = { code: "SE", name: "Sverige", level: "national", parent: null, results: LOCAL_YEARS.map(year => {
  const result = sumObservations(municipalities.map(a => a.results.find(r => r.year === year)!), year);
  sameCounts(result, fromArea(history.elections.find((r: { year: number }) => r.year === year), year), `national ${year}`); return result;
}) };
const counties: LocalArea[] = geometryManifest.archives.map((c: { countyCode: string; countyName: string }) => ({ code: c.countyCode, name: c.countyName, parent: "SE", level: "county", results: LOCAL_YEARS.map(year => sumObservations(municipalities.filter(a => a.parent === c.countyCode).map(a => a.results.find(r => r.year === year)!), year)) })).sort((a: LocalArea, b: LocalArea) => a.code.localeCompare(b.code));
assert.equal(counties.length, 21);
const previousDistricts = await parseLocalDistricts2018(join(dir, "rd2018-districts.xlsx"));
const districts = await parseLocalDistricts2022(join(dir, "rd2022.xlsx"));
assert.equal(districts.length, 6578); assert.equal(previousDistricts.length, 6325);
const mapping = await parseDistrictComparison(join(dir, "comparisons.xlsx"));
const previousByCode = new Map(previousDistricts.map(a => [a.code, a]));
const referenceCounts = new Map<string, number>();
for (const codes of mapping.values()) for (const code of codes) referenceCounts.set(code, (referenceCounts.get(code) ?? 0) + 1);
const byMunicipality: Record<string, LocalArea[]> = {};
for (const m of municipalities) {
  const currentRows = districts.filter(a => a.parent === m.code);
  const previousRows = previousDistricts.filter(a => a.parent === m.code);
  m.constituencies = [...new Set(currentRows.flatMap(a => a.constituencies!))].sort();
  for (const [year, rows] of [[2018, previousRows], [2022, currentRows]] as const) sameCounts(sumObservations(rows.map(a => a.results[0]), year), m.results.find(r => r.year === year)!, `${m.code} ${year}`);
  const physical = currentRows.filter(a => a.level === "district");
  for (const d of physical) {
    const codes = mapping.get(d.code); assert.ok(codes, `Missing district comparison ${d.code}`);
    const old = codes.map(code => { const area = previousByCode.get(code); assert.ok(area && area.level === "district" && area.parent === d.parent, `Invalid comparison target ${code}`); return area; });
    const shared = codes.some(c => referenceCounts.get(c)! > 1);
    const comparable = codes.length > 0 && !shared;
    d.comparison = { status: comparable ? "comparable" : "not-comparable", previousCodes: codes, previousNames: old.map(a => a.name), ...(!comparable ? { reason: shared ? "shared-baseline" as const : "boundary-change" as const } : {}) };
    if (comparable) d.results.unshift(sumObservations(old.map(a => a.results[0]), 2018));
  }
  const collection: LocalArea = { code: `${m.code}-collection`, name: "Uppsamlingsdistrikt", parent: m.code, level: "collection", results: ([2018, 2022] as const).map(year => sumObservations((year === 2018 ? previousRows : currentRows).filter(a => a.level === "collection").map(a => a.results[0]), year)) };
  byMunicipality[m.code] = [...physical, collection];
  collection.constituencies = m.constituencies;
}
for (const c of counties) c.constituencies = [...new Set(municipalities.filter(m => m.parent === c.code).flatMap(m => m.constituencies!))].sort();
national.constituencies = [...new Set(counties.flatMap(c => c.constituencies!))].sort();
assert.equal(mapping.size, districts.filter(a => a.level === "district").length);

// Keep the original 2022 archives and municipality geometry unchanged. Build
// additional district paths from the very same pinned county GIS archives.
type Feature = { properties: { Lkfv: string; Vdnamn: string }; geometry: LocalGeometry };
const features: Feature[] = [];
for (const archive of geometryManifest.archives) {
  const path = await source(`gis/${basename(new URL(archive.url).pathname)}`, archive.url, archive.sha256);
  const zip = await JSZip.loadAsync(await readFile(path)); const file = zip.file(archive.jsonFile); assert.ok(file);
  const input = join(dir, "gis", `${archive.countyCode}.json`);
  const contents = await file.async("text"); const raw = JSON.parse(contents);
  assert.ok(raw.features.every((f: Feature) => f.properties.Lkfv.startsWith(archive.countyCode)));
  await writeFile(input, contents);
  const output = join(dir, "gis", `${archive.countyCode}-simplified.json`);
  const executable = process.env.POLITICALVERSE_MAPSHAPER_BIN ?? "npx";
  execFileSync(executable, [...(executable === "npx" ? ["-p", "mapshaper@0.6.113", "mapshaper"] : []), input, "-simplify", "3%", "keep-shapes", "-o", "format=geojson", "precision=1", "force", output], { stdio: "pipe" });
  features.push(...JSON.parse(await readFile(output, "utf8")).features);
}
const physicalCodes = new Set(districts.filter(a => a.level === "district").map(a => a.code));
assert.equal(features.length, 6264); assert.equal(new Set(features.map(f => f.properties.Lkfv)).size, 6264);
assert.ok(features.every(f => physicalCodes.has(f.properties.Lkfv)));
manifest.districtNameFallbacks = [];
for (const district of districts.filter(d => d.level === "district" && !d.name)) {
  const feature = features.find(f => f.properties.Lkfv === district.code);
  assert.ok(feature, `Missing official GIS feature ${district.code}`);
  assert.ok(feature.properties.Vdnamn?.trim(), `Missing official GIS name ${district.code}`);
  district.name = feature.properties.Vdnamn.trim();
  manifest.districtNameFallbacks.push({ code: district.code, name: district.name, source: "Pinned 2022 GIS archive; result workbook has an empty name" });
}
const maps = Object.fromEntries(municipalities.map(m => [m.code, projectLocalMap(features.filter(f => f.properties.Lkfv.startsWith(m.code)).map(f => ({ code: f.properties.Lkfv, geometry: f.geometry })))]));
const common = { schemaVersion: 1, electionType: "RD", status: "final", boundaryYear: 2022, source: metadata };
const outputs = {
  "data/normalized/local-election-index.json": { ...common, national, counties, municipalities },
  "data/normalized/local-election-districts.json": { ...common, municipalities: byMunicipality },
  "data/normalized/district-paths-2022.json": { schemaVersion: 1, boundaryYear: 2022, source: { manifest: "data/raw/valmyndigheten/geography-source-manifest.json", normalizer: "mapshaper 0.6.113; simplify 3% keep-shapes; precision 1m SWEREF99 TM; fit SVG paths per municipality" }, maps },
};
// Validate every source and output before replacing any normalized artifact.
for (const [path, value] of Object.entries(outputs)) {
  const bytes = JSON.stringify(value) + "\n"; const checksum = sha(bytes);
  if (manifest.outputs[path]) assert.equal(checksum, manifest.outputs[path], `Normalized checksum ${path}`);
}
for (const [path, value] of Object.entries(outputs)) {
  const bytes = JSON.stringify(value) + "\n"; manifest.outputs[path] = sha(bytes); await writeFile(join(root, path), bytes);
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Verified ${counties.length} counties, ${municipalities.length} municipalities, ${physicalCodes.size} mapped districts, ${Object.values(byMunicipality).flat().filter(d => d.comparison?.status === "comparable").length} comparable district histories and four national totals; ${PARTY_IDS.length} party buckets.`);
