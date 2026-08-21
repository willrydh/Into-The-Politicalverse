import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import ExcelJS from "exceljs";
import type { NormalizedRiksdagData } from "../lib/data/elections/types";
import {
  SIMULATOR_PARTY_IDS,
  type BacktestExpectation,
  type RiksdagBacktest,
  type RiksdagConstituencyInput,
  type RiksdagSimulatorData,
  type SimulatorPartyId,
  type SimulatorPartySeats,
  type SimulatorPartyVotes,
} from "../lib/simulator/types";

type SourceDefinition = {
  fileName: string;
  url: string;
  sha256: string;
  worksheet?: string;
};

type ExpectedElection = {
  nationalValidVotes: number;
  partyVotes: SimulatorPartyVotes;
  fixed: SimulatorPartySeats;
  adjustment: SimulatorPartySeats;
  total: SimulatorPartySeats;
};

type SeatSourceManifest = {
  publisher: "Valmyndigheten";
  sourcePage: string;
  retrievedAt: string;
  rules: RiksdagSimulatorData["rules"];
  sources: Record<"result2018" | "mandates2018" | "fixedSeats2022" | "decision2022" | "fixedSeats2026", SourceDefinition>;
  expected: Record<"2018" | "2022", ExpectedElection>;
};

const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST_PATH = join(ROOT, "data/raw/valmyndigheten/seat-source-manifest.json");
const DEFAULT_SOURCE_DIR = join(ROOT, "data/raw/downloads");
const ELECTION_2022_PATH = join(ROOT, "data/normalized/riksdag-2022.json");
const OUTPUT_PATH = join(ROOT, "data/normalized/riksdag-seat-model-inputs.json");

function emptyVotes(): SimulatorPartyVotes {
  return Object.fromEntries(SIMULATOR_PARTY_IDS.map((partyId) => [partyId, 0])) as SimulatorPartyVotes;
}

function emptySeats(): SimulatorPartySeats {
  return Object.fromEntries(SIMULATOR_PARTY_IDS.map((partyId) => [partyId, 0])) as SimulatorPartySeats;
}

function sourceDirectory(): string {
  const index = process.argv.indexOf("--source-dir");
  return index >= 0 && process.argv[index + 1] ? resolve(process.argv[index + 1]) : DEFAULT_SOURCE_DIR;
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function ensureSource(definition: SourceDefinition, directory: string): Promise<string> {
  const path = join(directory, definition.fileName);
  if (!existsSync(path)) {
    const response = await fetch(definition.url);
    if (!response.ok) throw new Error(`Valmyndigheten download failed for ${definition.url}: ${response.status} ${response.statusText}`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
  }
  const actualSha = await sha256(path);
  if (actualSha !== definition.sha256) throw new Error(`Checksum mismatch for ${basename(path)}: ${actualSha}`);
  return path;
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    "&aring;": "å", "&Aring;": "Å", "&auml;": "ä", "&Auml;": "Ä", "&ouml;": "ö", "&Ouml;": "Ö",
    "&eacute;": "é", "&amp;": "&", "&nbsp;": " ", "&#246;": "ö", "&#228;": "ä", "&#229;": "å",
  };
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:aring|Aring|auml|Auml|ouml|Ouml|eacute|amp|nbsp);|&#(?:246|228|229);/g, (entity) => named[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

function integerCell(cell: ExcelJS.Cell): number {
  if (typeof cell.value === "number") return Math.trunc(cell.value);
  const value = Number(cell.text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function assertRecord(actual: SimulatorPartyVotes | SimulatorPartySeats, expected: SimulatorPartyVotes | SimulatorPartySeats, label: string): void {
  for (const partyId of SIMULATOR_PARTY_IDS) {
    if (actual[partyId] !== expected[partyId]) throw new Error(`${label} ${partyId}: got ${actual[partyId]}, expected ${expected[partyId]}`);
  }
}

function parse2018ResultHtml(html: string, expected: ExpectedElection): RiksdagConstituencyInput[] {
  const start = html.indexOf("R&ouml;stf&ouml;rdelning per riksdagsvalkrets");
  const end = html.indexOf("R&ouml;stf&ouml;rdelning &ouml;vriga partier", start);
  if (start < 0 || end < 0) throw new Error("Could not locate the 2018 constituency result table");
  const table = html.slice(start, end);
  const constituencies: RiksdagConstituencyInput[] = [];
  const countCellIndexes = { M: 2, C: 4, L: 6, KD: 8, S: 10, V: 12, MP: 14, SD: 16 } as const;

  for (const rowMatch of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const row = rowMatch[1];
    const codeMatch = row.match(/rvalkrets\/(\d+)\/index\.html/);
    if (!codeMatch) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => decodeHtml(match[1]));
    if (cells.length !== 29) throw new Error(`Unexpected 2018 constituency row width for ${cells[0]}: ${cells.length}`);
    const partyVotes = emptyVotes();
    for (const partyId of SIMULATOR_PARTY_IDS) partyVotes[partyId] = Number(cells[countCellIndexes[partyId]]);
    const otherVotes = Number(cells[18]) + Number(cells[20]);
    const validVotes = SIMULATOR_PARTY_IDS.reduce((sum, partyId) => sum + partyVotes[partyId], otherVotes);
    constituencies.push({ code: codeMatch[1].padStart(2, "0"), name: cells[0], validVotes, fixedSeats: 0, partyVotes });
  }

  if (constituencies.length !== 29) throw new Error(`Expected 29 constituencies in 2018 HTML, found ${constituencies.length}`);
  const nationalVotes = emptyVotes();
  let validVoteSum = 0;
  for (const constituency of constituencies) {
    validVoteSum += constituency.validVotes;
    for (const partyId of SIMULATOR_PARTY_IDS) nationalVotes[partyId] += constituency.partyVotes[partyId];
  }
  if (validVoteSum !== expected.nationalValidVotes) throw new Error(`2018 valid votes sum to ${validVoteSum}; expected ${expected.nationalValidVotes}`);
  assertRecord(nationalVotes, expected.partyVotes, "2018 national votes");
  return constituencies.sort((left, right) => left.code.localeCompare(right.code));
}

async function enrich2018Mandates(path: string, worksheetName: string, constituencies: RiksdagConstituencyInput[], expected: ExpectedElection): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const worksheet = workbook.getWorksheet(worksheetName);
  if (!worksheet) throw new Error(`Worksheet ${worksheetName} not found in 2018 mandate workbook`);
  const byCode = new Map(constituencies.map((constituency) => [constituency.code, constituency]));
  const fixed = emptySeats();
  const adjustment = emptySeats();
  const total = emptySeats();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || row.getCell(1).text.trim() !== "R") return;
    const code = row.getCell(4).text.trim().padStart(2, "0");
    const partyId = row.getCell(6).text.trim() as SimulatorPartyId;
    if (!SIMULATOR_PARTY_IDS.includes(partyId)) throw new Error(`Unexpected party ${partyId} in 2018 mandate workbook`);
    const constituency = byCode.get(code);
    if (!constituency) throw new Error(`Unknown 2018 constituency code ${code}`);
    const sourceName = row.getCell(5).text.trim();
    if (constituency.name !== sourceName) throw new Error(`2018 constituency name mismatch for ${code}: ${constituency.name} / ${sourceName}`);
    const fixedSeats = integerCell(row.getCell(10));
    const adjustmentSeats = integerCell(row.getCell(11));
    const totalSeats = integerCell(row.getCell(12));
    constituency.fixedSeats += fixedSeats;
    fixed[partyId] += fixedSeats;
    adjustment[partyId] += adjustmentSeats;
    total[partyId] += totalSeats;
  });

  if (constituencies.reduce((sum, constituency) => sum + constituency.fixedSeats, 0) !== 310) throw new Error("2018 fixed seats do not sum to 310");
  assertRecord(fixed, expected.fixed, "2018 official fixed seats");
  assertRecord(adjustment, expected.adjustment, "2018 official adjustment seats");
  assertRecord(total, expected.total, "2018 official total seats");
}

async function parseFixedSeatWorkbook(path: string, worksheetName: string, constituencies: RiksdagConstituencyInput[]): Promise<Record<string, number>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const worksheet = workbook.getWorksheet(worksheetName);
  if (!worksheet) throw new Error(`Worksheet ${worksheetName} not found in fixed-seat workbook`);
  const codeByName = new Map(constituencies.map((constituency) => [constituency.name, constituency.code]));
  const fixedSeats: Record<string, number> = {};

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const electionType = row.getCell(1).text.trim();
    if (electionType !== "Val till Riksdagen" && electionType !== "R") return;
    const name = row.getCell(5).text.trim();
    const code = codeByName.get(name);
    if (!code) throw new Error(`Fixed-seat source has unknown Riksdag constituency ${name}`);
    fixedSeats[code] = integerCell(row.getCell(10));
  });

  if (Object.keys(fixedSeats).length !== 29) throw new Error(`Expected 29 fixed-seat rows, found ${Object.keys(fixedSeats).length}`);
  if (Object.values(fixedSeats).reduce((sum, seats) => sum + seats, 0) !== 310) throw new Error("Fixed-seat workbook does not sum to 310");
  return fixedSeats;
}

function backtestExpectation(expected: ExpectedElection): BacktestExpectation {
  return { fixed: expected.fixed, adjustment: expected.adjustment, total: expected.total };
}

function build2022Backtest(election: NormalizedRiksdagData, fixedSeats: Record<string, number>, expected: ExpectedElection): RiksdagBacktest {
  if (election.national.validVotes !== expected.nationalValidVotes) throw new Error("2022 national valid-vote total differs from seat manifest");
  const nationalVotes = emptyVotes();
  const constituencies = election.constituencies.map((area) => {
    const partyVotes = emptyVotes();
    for (const partyId of SIMULATOR_PARTY_IDS) {
      const result = area.parties.find((party) => party.partyId === partyId);
      if (!result) throw new Error(`Missing ${partyId} in ${area.name}`);
      partyVotes[partyId] = result.votes;
      nationalVotes[partyId] += result.votes;
    }
    return { code: area.code, name: area.name, validVotes: area.validVotes, fixedSeats: fixedSeats[area.code], partyVotes };
  });
  assertRecord(nationalVotes, expected.partyVotes, "2022 national votes");
  return { year: 2022, nationalValidVotes: expected.nationalValidVotes, constituencies, expected: backtestExpectation(expected) };
}

async function main(): Promise<void> {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as SeatSourceManifest;
  const directory = sourceDirectory();
  const sourcePaths = Object.fromEntries(await Promise.all(Object.entries(manifest.sources).map(async ([id, definition]) => [id, await ensureSource(definition, directory)]))) as Record<keyof SeatSourceManifest["sources"], string>;
  const election2022 = JSON.parse(await readFile(ELECTION_2022_PATH, "utf8")) as NormalizedRiksdagData;

  const constituencies2018 = parse2018ResultHtml(await readFile(sourcePaths.result2018, "utf8"), manifest.expected["2018"]);
  await enrich2018Mandates(sourcePaths.mandates2018, manifest.sources.mandates2018.worksheet ?? "", constituencies2018, manifest.expected["2018"]);
  const fixedSeats2022 = await parseFixedSeatWorkbook(sourcePaths.fixedSeats2022, manifest.sources.fixedSeats2022.worksheet ?? "", constituencies2018);
  const backtest2022 = build2022Backtest(election2022, fixedSeats2022, manifest.expected["2022"]);
  const fixedSeats2026 = await parseFixedSeatWorkbook(sourcePaths.fixedSeats2026, manifest.sources.fixedSeats2026.worksheet ?? "", backtest2022.constituencies);

  const data: RiksdagSimulatorData = {
    schemaVersion: 1,
    source: {
      publisher: manifest.publisher,
      retrievedAt: manifest.retrievedAt,
      classification: "OFFICIAL",
      sourcePage: manifest.sourcePage,
      sources: Object.entries(manifest.sources).map(([id, source]) => ({ id, url: source.url, sha256: source.sha256 })),
    },
    rules: manifest.rules,
    backtests: [
      { year: 2018, nationalValidVotes: manifest.expected["2018"].nationalValidVotes, constituencies: constituencies2018, expected: backtestExpectation(manifest.expected["2018"]) },
      backtest2022,
    ],
    scenario: { baselineElection: 2022, fixedSeatElection: 2026, fixedSeatsByConstituency: fixedSeats2026 },
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${data.backtests.length} seat backtests and 29 official 2026 constituency allocations to ${OUTPUT_PATH}`);
}

await main();
