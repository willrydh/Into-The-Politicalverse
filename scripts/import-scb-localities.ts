import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readXlsxWorkbook } from "../lib/data/valmyndigheten/xlsx";
import { validateLocalities, type Locality, type LocalityData } from "../lib/search/localities";

const url = "https://www.scb.se/contentassets/b7f6aeab34344238b4c4573620ff76c9/mi0810_2023_tatorter2023_kommun_bef_area_v3.xlsx";
const expectedSha = "d743b0df767ee267e715545e4809c0ea51c5102d56af12088183a9610e6793e9";
const path = "data/raw/downloads/scb-localities-2023.xlsx";
await mkdir("data/raw/downloads", { recursive: true });
if (!process.argv.includes("--local")) {
  const response = await fetch(url, { signal: AbortSignal.timeout(40_000) });
  if (!response.ok) throw new Error(`SCB response ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== expectedSha) throw new Error("SCB workbook changed; review before import");
  await writeFile(path, bytes);
}
if (createHash("sha256").update(await readFile(path)).digest("hex") !== expectedSha) throw new Error("SCB checksum mismatch");
const sheet = (await readXlsxWorkbook(path)).getWorksheet("Tätorter_kommun_2023");
if (!sheet || sheet.getRow(9).getCell(5).text !== "Tätortskod" || sheet.getRow(9).getCell(6).text !== "Tätortsbeteckning" || sheet.getRow(9).getCell(3).text.trim() !== "Kommunkod") throw new Error("SCB workbook schema changed");
const places = new Map<string, Locality>();
sheet.eachRow((row, number) => {
  if (number < 10) return;
  const code = row.getCell(5).text; if (!code) return;
  const name = row.getCell(6).text; const municipality = row.getCell(3).text;
  const place = places.get(code) ?? { code, name, municipalities: [] };
  if (place.name !== name || place.municipalities.includes(municipality)) throw new Error(`Conflicting locality ${code}`);
  place.municipalities.push(municipality); places.set(code, place);
});
const data: LocalityData = { schemaVersion: 1, year: 2023, source: { publisher: "SCB", url, retrievedAt: "2026-09-07", sha256: expectedSha, namesUpdatedAt: "2025-11-24" }, localities: [...places.values()].sort((a, b) => a.code.localeCompare(b.code)) };
const geography = JSON.parse(await readFile("data/normalized/local-election-index.json", "utf8"));
validateLocalities(data, new Set(geography.municipalities.map((m: { code: string }) => m.code)));
const normalized = JSON.stringify(data) + "\n";
await writeFile("data/normalized/scb-localities-2023.json", normalized);
await mkdir("data/raw/scb", { recursive: true });
await writeFile("data/raw/scb/localities-source-manifest.json", JSON.stringify({ ...data.source, year: data.year, localities: 2017, municipalityRelations: 2144, normalizedSha256: createHash("sha256").update(normalized).digest("hex") }, null, 2) + "\n");
console.log(`Validated ${data.localities.length} SCB localities and all 2,144 municipality relations.`);
