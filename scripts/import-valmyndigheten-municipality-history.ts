import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import type { MunicipalityHistoryData, PartyId } from "../lib/data/elections/types";
import { parseMunicipalityWorkbook } from "../lib/data/valmyndigheten/municipalities";

type SourceManifest = {
  publisher: string;
  retrievedAt: string;
  election2018: {
    url: string;
    sha256: string;
    description: string;
    worksheetCounts: string;
    worksheetPercentages: string;
  };
  comparability: {
    url: string;
    note: string;
  };
  expected2018: {
    municipalities: number;
    validVotes: number;
    totalVotes: number;
    eligibleVoters: number;
    partyVotes: Record<PartyId, number>;
  };
};

const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST_PATH = join(ROOT, "data/raw/valmyndigheten/municipality-history-source-manifest.json");
const DOWNLOAD_PATH = join(ROOT, "data/raw/downloads/2018_R_per_kommun.xlsx");
const OUTPUT_PATH = join(ROOT, "data/normalized/riksdag-municipalities-2018.json");

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function downloadSource(url: string, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Valmyndigheten download failed: ${response.status} ${response.statusText}`);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

function sourceArgument(): string {
  const fileIndex = process.argv.indexOf("--file");
  if (fileIndex >= 0 && process.argv[fileIndex + 1]) return resolve(process.argv[fileIndex + 1]);
  return DOWNLOAD_PATH;
}

function validateTotals(data: MunicipalityHistoryData, manifest: SourceManifest): void {
  const totals = {
    validVotes: 0,
    totalVotes: 0,
    eligibleVoters: 0,
    partyVotes: Object.fromEntries(Object.keys(manifest.expected2018.partyVotes).map((partyId) => [partyId, 0])) as Record<PartyId, number>,
  };
  for (const municipality of data.municipalities) {
    totals.validVotes += municipality.validVotes;
    totals.totalVotes += municipality.totalVotes;
    totals.eligibleVoters += municipality.eligibleVoters;
    for (const party of municipality.parties) totals.partyVotes[party.partyId] += party.votes;
  }

  const expected = manifest.expected2018;
  if (data.municipalities.length !== expected.municipalities) throw new Error(`Expected ${expected.municipalities} municipalities`);
  for (const key of ["validVotes", "totalVotes", "eligibleVoters"] as const) {
    if (totals[key] !== expected[key]) throw new Error(`${key}: got ${totals[key]}, expected ${expected[key]}`);
  }
  for (const [partyId, expectedVotes] of Object.entries(expected.partyVotes) as [PartyId, number][]) {
    if (totals.partyVotes[partyId] !== expectedVotes) throw new Error(`${partyId}: got ${totals.partyVotes[partyId]}, expected ${expectedVotes}`);
  }
}

async function main(): Promise<void> {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as SourceManifest;
  const sourcePath = sourceArgument();
  if (!existsSync(sourcePath)) await downloadSource(manifest.election2018.url, sourcePath);
  const actualSha = await sha256(sourcePath);
  if (actualSha !== manifest.election2018.sha256) throw new Error(`Source checksum mismatch for ${basename(sourcePath)}: ${actualSha}`);

  const data: MunicipalityHistoryData = {
    schemaVersion: 1,
    source: {
      publisher: manifest.publisher,
      dataset: manifest.election2018.description,
      sourceUrl: manifest.election2018.url,
      sourceSha256: manifest.election2018.sha256,
      retrievedAt: manifest.retrievedAt,
      attribution: "Source: Valmyndigheten",
      classification: "OFFICIAL",
    },
    election: { year: 2018, electionDate: "2018-09-09", type: "RD", status: "final" },
    geographyComparison: {
      level: "municipality",
      fromBoundaryYear: 2018,
      toBoundaryYear: 2022,
      status: "comparable",
      basisUrl: manifest.comparability.url,
      note: manifest.comparability.note,
    },
    municipalities: await parseMunicipalityWorkbook(sourcePath),
  };
  validateTotals(data, manifest);
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${data.municipalities.length} comparable 2018 municipality observations (${actualSha.slice(0, 12)}…).`);
}

await main();
