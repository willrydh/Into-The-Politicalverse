import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { PARTY_IDS, type AreaResult, type HistoricalElection, type NormalizedRiksdagData, type PartyId } from "../lib/data/elections/types";
import { VALMYNDIGHETEN_PARTY_NAMES } from "../lib/data/elections/parties";
import { buildNationalHistoryData, loadHistoricalNationalCsv } from "../lib/data/valmyndigheten/history";
import { readXlsxWorkbook, type XlsxCell } from "../lib/data/valmyndigheten/xlsx";

type SourceManifest = {
  publisher: string;
  retrievedAt: string;
  election2022: {
    url: string;
    sha256: string;
    worksheet: string;
    description: string;
  };
  history: { year: number; url: string }[];
  expected2022: {
    validVotes: number;
    totalVotes: number;
    eligibleVoters: number;
    turnout: number;
    partyVotes: Record<PartyId, number>;
  };
};

type MutableArea = {
  code: string;
  name: string;
  districts: Set<string>;
  validVotes: number;
  totalVotes: number;
  eligibleVoters: number;
  partyVotes: Record<PartyId, number>;
};

const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST_PATH = join(ROOT, "data/raw/valmyndigheten/source-manifest.json");
const HISTORY_PATH = join(ROOT, "data/raw/valmyndigheten/riksdag-national-2002-2018.csv");
const DOWNLOAD_PATH = join(ROOT, "data/raw/downloads/valmyndigheten-riksdag-2022.xlsx");
const ELECTION_OUTPUT_PATH = join(ROOT, "data/normalized/riksdag-2022.json");
const HISTORY_OUTPUT_PATH = join(ROOT, "data/normalized/riksdag-national-history.json");

const NATIONAL_SEATS: Partial<Record<PartyId, number>> = {
  M: 68,
  C: 24,
  L: 16,
  KD: 19,
  S: 107,
  V: 24,
  MP: 18,
  SD: 73,
};

function emptyPartyVotes(): Record<PartyId, number> {
  return Object.fromEntries(PARTY_IDS.map((partyId) => [partyId, 0])) as Record<PartyId, number>;
}

function createArea(code: string, name: string): MutableArea {
  return {
    code,
    name,
    districts: new Set<string>(),
    validVotes: 0,
    totalVotes: 0,
    eligibleVoters: 0,
    partyVotes: emptyPartyVotes(),
  };
}

function numberFromCell(cell: XlsxCell): number {
  if (typeof cell.value === "number") return cell.value;
  const normalized = cell.text.trim().replace(/\s/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function textFromCell(cell: XlsxCell): string {
  return cell.text.trim();
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function finalizeArea(area: MutableArea, includeSeats = false): AreaResult {
  // The source sheet itemizes minor parties. Its own "övriga anmälda partier"
  // row is only a residual bucket, so the canonical Other value must be derived.
  const parliamentaryVotes = PARTY_IDS.filter((partyId) => partyId !== "OTHER").reduce(
    (sum, partyId) => sum + area.partyVotes[partyId],
    0,
  );
  const partyVotes = { ...area.partyVotes, OTHER: area.validVotes - parliamentaryVotes };

  return {
    code: area.code,
    name: area.name,
    districtCount: area.districts.size,
    validVotes: area.validVotes,
    totalVotes: area.totalVotes,
    eligibleVoters: area.eligibleVoters,
    turnout: area.eligibleVoters > 0 ? round((area.totalVotes / area.eligibleVoters) * 100) : 0,
    parties: PARTY_IDS.map((partyId) => ({
      partyId,
      votes: partyVotes[partyId],
      share: area.validVotes > 0 ? round((partyVotes[partyId] / area.validVotes) * 100) : 0,
      ...(includeSeats && NATIONAL_SEATS[partyId] !== undefined ? { seats: NATIONAL_SEATS[partyId] } : {}),
    })),
  };
}

function updateArea(area: MutableArea, districtCode: string, partyName: string, votes: number, eligibleVoters: number): void {
  const partyId = VALMYNDIGHETEN_PARTY_NAMES[partyName];
  if (partyId) {
    area.partyVotes[partyId] += votes;
    return;
  }

  if (partyName === "Summa giltiga röster") {
    area.validVotes += votes;
    return;
  }

  if (partyName === "Valdeltagande") {
    if (area.districts.has(districtCode)) {
      throw new Error(`Duplicate turnout row for district ${districtCode} in area ${area.code}`);
    }
    area.districts.add(districtCode);
    area.totalVotes += votes;
    area.eligibleVoters += eligibleVoters;
  }
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function downloadSource(url: string, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Valmyndigheten download failed: ${response.status} ${response.statusText}`);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

function parseSourceArgument(): string {
  const fileIndex = process.argv.indexOf("--file");
  if (fileIndex >= 0 && process.argv[fileIndex + 1]) return resolve(process.argv[fileIndex + 1]);
  return DOWNLOAD_PATH;
}

function assertExpectedNational(area: AreaResult, manifest: SourceManifest): void {
  const expected = manifest.expected2022;
  const failures: string[] = [];

  for (const key of ["validVotes", "totalVotes", "eligibleVoters"] as const) {
    if (area[key] !== expected[key]) failures.push(`${key}: got ${area[key]}, expected ${expected[key]}`);
  }
  if (area.turnout !== expected.turnout) failures.push(`turnout: got ${area.turnout}, expected ${expected.turnout}`);

  for (const party of area.parties) {
    if (party.votes !== expected.partyVotes[party.partyId]) {
      failures.push(`${party.partyId}: got ${party.votes}, expected ${expected.partyVotes[party.partyId]}`);
    }
  }

  if (failures.length) throw new Error(`National validation failed:\n${failures.join("\n")}`);
}

async function importWorkbook(sourcePath: string, manifest: SourceManifest): Promise<NormalizedRiksdagData> {
  const workbook = await readXlsxWorkbook(sourcePath);
  const worksheet = workbook.getWorksheet(manifest.election2022.worksheet);
  if (!worksheet) throw new Error(`Worksheet ${manifest.election2022.worksheet} was not found`);

  const actualHeaders = Array.from({ length: 12 }, (_, index) => textFromCell(worksheet.getRow(1).getCell(index + 1)));
  const expectedHeaders = [
    "Val",
    "Distrikt",
    "Län",
    "Region",
    "Kommun",
    "Valdistriktskod",
    "Valdistriktnamn",
    "Valkretskod",
    "Valkretsnamn",
    "Parti",
    "Röster",
    "Röstberättigade",
  ];
  if (actualHeaders.join("|") !== expectedHeaders.join("|")) {
    throw new Error(`Unexpected worksheet schema: ${actualHeaders.join(" | ")}`);
  }

  const national = createArea("SE", "Sweden");
  const constituencies = new Map<string, MutableArea>();
  const municipalities = new Map<string, MutableArea>();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const electionType = textFromCell(row.getCell(1));
    if (electionType !== "RD") return;

    const districtKey = textFromCell(row.getCell(2));
    const municipalityName = textFromCell(row.getCell(5));
    const districtCode = textFromCell(row.getCell(6)).padStart(6, "0");
    const constituencyCode = textFromCell(row.getCell(8)).padStart(2, "0");
    const constituencyName = textFromCell(row.getCell(9));
    const partyName = textFromCell(row.getCell(10));
    const votes = numberFromCell(row.getCell(11));
    const eligibleVoters = numberFromCell(row.getCell(12));
    const municipalityCode = districtCode.slice(0, 4);

    if (!districtKey || !partyName || !municipalityName || !constituencyName) return;

    const constituency = constituencies.get(constituencyCode) ?? createArea(constituencyCode, constituencyName);
    const municipality = municipalities.get(municipalityCode) ?? createArea(municipalityCode, municipalityName);
    constituencies.set(constituencyCode, constituency);
    municipalities.set(municipalityCode, municipality);

    updateArea(national, districtKey, partyName, votes, eligibleVoters);
    updateArea(constituency, districtKey, partyName, votes, eligibleVoters);
    updateArea(municipality, districtKey, partyName, votes, eligibleVoters);
  });

  const normalizedNational = finalizeArea(national, true);
  assertExpectedNational(normalizedNational, manifest);

  return {
    schemaVersion: 1,
    source: {
      publisher: manifest.publisher,
      dataset: manifest.election2022.description,
      sourceUrl: manifest.election2022.url,
      sourceSha256: manifest.election2022.sha256,
      retrievedAt: manifest.retrievedAt,
      attribution: "Source: Valmyndigheten",
      classification: "OFFICIAL",
    },
    election: {
      year: 2022,
      electionDate: "2022-09-11",
      type: "RD",
      status: "final",
    },
    national: normalizedNational,
    constituencies: [...constituencies.values()].map((area) => finalizeArea(area)).sort((a, b) => a.code.localeCompare(b.code)),
    municipalities: [...municipalities.values()].map((area) => finalizeArea(area)).sort((a, b) => a.code.localeCompare(b.code)),
  };
}

async function main(): Promise<void> {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as SourceManifest;
  const sourcePath = parseSourceArgument();

  if (!existsSync(sourcePath)) {
    console.log(`Downloading ${manifest.election2022.url}`);
    await downloadSource(manifest.election2022.url, sourcePath);
  }

  const actualSha = await sha256(sourcePath);
  if (actualSha !== manifest.election2022.sha256) {
    throw new Error(`Source checksum mismatch for ${basename(sourcePath)}: ${actualSha}`);
  }

  console.log(`Importing ${basename(sourcePath)} (${actualSha.slice(0, 12)}…)`);
  const electionData = await importWorkbook(sourcePath, manifest);
  const historicalElections = await loadHistoricalNationalCsv(HISTORY_PATH);
  const currentElection: HistoricalElection = {
    ...electionData.national,
    year: 2022,
    electionDate: electionData.election.electionDate,
  };
  const historyData = buildNationalHistoryData([...historicalElections, currentElection], {
    publisher: manifest.publisher,
    dataset: "Final national Riksdag results, 2002–2022",
    attribution: "Source: Valmyndigheten",
    retrievedAt: manifest.retrievedAt,
    classification: "OFFICIAL",
    urls: [...manifest.history, { year: 2022, url: manifest.election2022.url }],
  });

  await mkdir(dirname(ELECTION_OUTPUT_PATH), { recursive: true });
  await writeFile(ELECTION_OUTPUT_PATH, `${JSON.stringify(electionData, null, 2)}\n`);
  await writeFile(HISTORY_OUTPUT_PATH, `${JSON.stringify(historyData, null, 2)}\n`);

  console.log(
    `Wrote ${electionData.constituencies.length} constituencies, ${electionData.municipalities.length} municipalities and ${historyData.elections.length} national elections.`,
  );
}

await main();
