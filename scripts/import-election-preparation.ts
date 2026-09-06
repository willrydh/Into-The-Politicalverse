import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { readXlsxWorkbook, type XlsxRow, type XlsxWorksheet } from "../lib/data/valmyndigheten/xlsx";
import { parseSemicolonCsv } from "../lib/live/early-voting";
import { digest, download } from "../lib/live/official-files";
import { insist, integer } from "../lib/live/validation";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "data/raw/valmyndigheten-2026/preparation-source-manifest.json"), "utf8")) as { publisher: string; classification: string; retrievedAt: string; sourcePage: string; sources: { fileName: string; url: string; sha256: string; bytes: number }[] };
const sourceDir = resolve(root, "data/raw/downloads"); await mkdir(sourceDir, { recursive: true });
for (const source of manifest.sources) {
  const path = resolve(sourceDir, source.fileName);
  let raw: Buffer;
  try { raw = await readFile(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; raw = (await download(source.url, 16 * 1024 * 1024))!; await writeFile(path, raw); }
  insist(digest(raw) === source.sha256, `Source checksum changed: ${source.fileName}; review before importing`);
}
function rows(sheet: XlsxWorksheet | undefined): XlsxRow[] { insist(sheet, "Missing official worksheet"); const result: XlsxRow[] = []; sheet.eachRow((row, i) => { if (i > 1) result.push(row); }); return result; }
function number(row: XlsxRow, column: number): number { return integer(row.getCell(column).value, `numeric column ${column}`); }
function categories(row: XlsxRow, start: number) {
  const ageGroups = [0, 1, 2, 3].map(i => number(row, start + i));
  const men = number(row, start + 4), women = number(row, start + 5), firstTime = number(row, start + 6), abroad = number(row, start + 7), total = number(row, start + 8);
  insist(ageGroups.reduce((a, b) => a + b, 0) === total && men + women === total && firstTime <= total && abroad <= total, "Eligibility categories do not reconcile");
  return { total, ageGroups, men, women, firstTime, abroad };
}
const eligible = await readXlsxWorkbook(resolve(sourceDir, "eligible-rd.xlsx"));
const districtRows = rows(eligible.getWorksheet("rostber_per_distrikt"));
const municipalityRows = rows(eligible.getWorksheet("rostber_per_kommun"));
insist(districtRows.at(-1)!.getCell(6).text === "Totalt" && municipalityRows.at(-1)!.getCell(4).text === "Totalt", "Missing eligibility total rows");
const national = categories(districtRows.pop()!, 7);
insist(JSON.stringify(categories(municipalityRows.pop()!, 5)) === JSON.stringify(national), "National eligibility totals disagree");
insist(national.total === 8_046_725 && national.firstTime === 483_182 && national.abroad === 226_906, "Qualification-day figures differ from the official published table");
const districtEligibility = new Map(districtRows.map(row => [row.getCell(5).text, { constituency: row.getCell(1).text, municipality: row.getCell(3).text, ...categories(row, 7) }]));
insist(districtEligibility.size === districtRows.length, "Duplicate eligible-voter district");
const municipalities = municipalityRows.map(row => ({ code: row.getCell(3).text, name: row.getCell(4).text, ...categories(row, 5) }));
insist(municipalities.length === 290 && new Set(municipalities.map(m => m.code)).size === 290 && municipalities.reduce((s, m) => s + m.total, 0) === national.total, "Municipal eligibility coverage mismatch");
const geography = await readXlsxWorkbook(resolve(sourceDir, "districts-2026.xlsx"));
const comparison = await readXlsxWorkbook(resolve(sourceDir, "district-comparability.xlsx"));
const comparisons = new Map(rows(comparison.getWorksheet("Jämförelser")).map(row => [row.getCell(1).text, { status: row.getCell(5).text, previousDistricts: [row.getCell(6).text, row.getCell(7).text].filter(Boolean) }]));
const districts = rows(geography.getWorksheet("Valdistrikt 2026")).map(row => {
  const code = row.getCell(13).text; const voters = districtEligibility.get(code); const compare = comparisons.get(code);
  insist(/^\d{8}$/.test(code) && voters && compare, "District geography, eligibility and comparability do not join");
  insist(voters.constituency === row.getCell(3).text && voters.municipality === row.getCell(5).text, "District parent geography mismatch");
  insist(["Kan jämföras", "Ej jämförbart", "Kan jämföras mot flera"].includes(compare.status), "Unknown official comparability status");
  insist(compare.status !== "Kan jämföras mot flera" || compare.previousDistricts.length > 1, "Multi-district comparison requires every old district");
  return { code, name: row.getCell(14).text, constituency: voters.constituency, municipality: voters.municipality, eligibleVoters: voters.total, comparableTo2022: compare.status !== "Ej jämförbart", comparisonStatus: compare.status, previousDistricts: compare.previousDistricts };
});
insist(districts.length === 6312 && new Set(districts.map(d => d.code)).size === 6312 && comparisons.size === 6312, "Reviewed 2026 district coverage changed");
insist(districts.reduce((s, d) => s + d.eligibleVoters, 0) === national.total, "District eligibility total mismatch");
for (const municipality of municipalities) insist(districts.filter(d => d.municipality === municipality.code).reduce((s, d) => s + d.eligibleVoters, 0) === municipality.total, `Municipality/district eligibility mismatch: ${municipality.code}`);
const [header, ...partyRows] = parseSemicolonCsv(await readFile(resolve(sourceDir, "deltagande-partier.csv"), "utf8"));
const col = (name: string) => { const i = header.indexOf(name); insist(i >= 0, `Missing party-register column ${name}`); return i; };
const rdParties = new Map<string, { code: string; name: string; abbreviation: string }>();
for (const row of partyRows.filter(r => r[col("VALTYP")] === "RD")) {
  const code = row[col("PARTIKOD")]; insist(/^\d{4}$/.test(code), "Party code lost leading zeros");
  const party = { code, name: row[col("PARTIBETECKNING")], abbreviation: row[col("PARTIFÖRKORTNING")].trim() };
  insist(!rdParties.has(code) || JSON.stringify(rdParties.get(code)) === JSON.stringify(party), "Inconsistent registered party identity"); rdParties.set(code, party);
}
const report = await readXlsxWorkbook(resolve(sourceDir, "report-parties.xlsx"));
const reportParties = rows(report.getWorksheet("Blad1")).filter(row => row.getCell(1).text === "Riksdag").map(row => row.getCell(4).text);
insist(reportParties.length === 8 && reportParties.every(name => [...rdParties.values()].some(p => p.name === name)), "Report-party register mismatch");
const data = { schemaVersion: 1, classification: "OFFICIAL", electionDate: "2026-09-13", qualificationDate: "2026-08-14", source: manifest, national, municipalities, districts, registeredRiksdagParties: [...rdParties.values()].sort((a, b) => a.code.localeCompare(b.code)), reportParties };
await writeFile(resolve(root, "data/normalized/election-preparation-2026.json"), `${JSON.stringify(data, null, 2)}\n`);
console.log(JSON.stringify({ eligibleVoters: national.total, municipalities: municipalities.length, districts: districts.length, comparableDistricts: districts.filter(d => d.comparableTo2022).length, registeredParties: rdParties.size, reportParties: reportParties.length }));
