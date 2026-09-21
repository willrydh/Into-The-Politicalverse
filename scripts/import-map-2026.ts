import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import JSZip from "jszip";
import { digest, download } from "../lib/live/official-files";
import { projectLocalMap, type LocalGeometry } from "../lib/data/geography/local-projection";
import preparation from "../data/normalized/election-preparation-2026.json";

const url = "https://www.val.se/download/18.332cf48819bd61ac1513889/1785491689960/valdistrikt-riket-2026.zip";
const dir = "data/raw/downloads/map-2026";
const manifestPath = "data/raw/valmyndigheten-2026/map-source-manifest.json";
await mkdir(dir, { recursive: true });
const bytes = await download(url, 40 * 1024 * 1024); assert.ok(bytes);
let previous: { archiveSha256: string } | undefined;
try { previous = JSON.parse(await readFile(manifestPath, "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
if (previous) assert.equal(digest(bytes), previous.archiveSha256, "GIS source changed; review before accepting new boundaries");
const zip = await JSZip.loadAsync(bytes), file = zip.file("valdistrikt-riket-2026.geojson"); assert.ok(file);
const raw = await file.async("text");
type Feature = { properties: Record<string, string>; geometry: LocalGeometry };
const original = JSON.parse(raw) as { crs: { properties: { name: string } }; features: Feature[] };
assert.equal(original.crs.properties.name, "urn:ogc:def:crs:EPSG::3006");
assert.equal(original.features.length, 6312);
assert.equal(new Set(original.features.map(f => f.properties.Valdistriktskod)).size, 6312);
for (const f of original.features) {
  const p = f.properties, d = preparation.districts.find(d => d.code === p.Valdistriktskod);
  assert.ok(d && d.municipality === p.Kommunkod && d.constituency === p.Riksdagsvalkretskod && p.Kommunkod.startsWith(p["Länskod"]), `2026 district identity ${p.Valdistriktskod}`);
}
await writeFile(`${dir}/original.json`, raw);
const executable = process.env.POLITICALVERSE_MAPSHAPER_BIN ?? "npx";
const run = (args: string[]) => execFileSync(executable, [...(executable === "npx" ? ["--yes", "-p", "mapshaper@0.6.113", "mapshaper"] : []), ...args], { stdio: "pipe" });
run([`${dir}/original.json`, "-simplify", "3%", "keep-shapes", "-o", "format=geojson", "precision=1", "force", `${dir}/districts.json`]);
run([`${dir}/original.json`, "-dissolve", "Kommunkod", "-simplify", "3%", "keep-shapes", "-o", "format=geojson", "precision=1", "force", `${dir}/municipalities.json`]);
run([`${dir}/original.json`, "-dissolve", "Länskod", "-simplify", "3%", "keep-shapes", "-o", "format=geojson", "precision=1", "force", `${dir}/counties.json`]);
const features = async (name: string): Promise<Feature[]> => JSON.parse(await readFile(`${dir}/${name}.json`, "utf8")).features;
const districts = await features("districts"), municipalities = await features("municipalities"), counties = await features("counties");
assert.equal(municipalities.length, 290); assert.equal(counties.length, 21); assert.equal(districts.length, 6312);
const paths = (rows: Feature[], key: string) => projectLocalMap(rows.map(f => ({ code: f.properties[key], geometry: f.geometry })));
const result = { schemaVersion: 1, boundaryYear: 2026, archiveSha256: digest(bytes), map: paths(counties, "Länskod"), countyMaps: Object.fromEntries(counties.map(c => [c.properties["Länskod"], paths(municipalities.filter(m => m.properties.Kommunkod.startsWith(c.properties["Länskod"])), "Kommunkod")])), districtMaps: Object.fromEntries(municipalities.map(m => [m.properties.Kommunkod, paths(districts.filter(d => d.properties.Kommunkod === m.properties.Kommunkod), "Valdistriktskod")])) };
const output = Buffer.from(JSON.stringify(result) + "\n");
await writeFile("data/normalized/map-geometry-2026.json.gz", gzipSync(output));
await writeFile(manifestPath, JSON.stringify({ schemaVersion: 1, boundaryYear: 2026, publisher: "Valmyndigheten", url, retrievedAt: new Date().toISOString(), archiveSha256: digest(bytes), outputSha256: digest(output), districts: 6312, municipalities: 290, counties: 21, normalizer: "mapshaper 0.6.113; dissolve administrative boundaries; simplify 3% keep-shapes; precision 1m SWEREF99 TM; fit SVG per area" }, null, 2) + "\n");
console.log("Verified 2026 geometry: 21 counties, 290 municipalities, 6312 physical districts.");
