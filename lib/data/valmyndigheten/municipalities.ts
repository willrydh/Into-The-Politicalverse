import { PARTY_IDS, type MunicipalityElectionResult, type PartyId } from "@/lib/data/elections/types";
import { readXlsxWorkbook, type XlsxCell, type XlsxRow, type XlsxWorksheet } from "@/lib/data/valmyndigheten/xlsx";

const PARLIAMENTARY_PARTIES = PARTY_IDS.filter((partyId): partyId is Exclude<PartyId, "OTHER"> => partyId !== "OTHER");
const REQUIRED_HEADERS = [
  "LÄNSKOD",
  "KOMMUNKOD",
  "LÄNSNAMN",
  "KOMMUNNAMN",
  ...PARLIAMENTARY_PARTIES,
  "RÖSTER GILTIGA",
  "RÖSTANDE",
  "RÖSTBERÄTTIGADE",
  "VALDELTAGANDE",
] as const;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function numberFromCell(cell: XlsxCell): number {
  if (typeof cell.value === "number") return cell.value;
  const value = Number(cell.text.trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(value)) throw new Error(`Expected a number, found "${cell.text}"`);
  return value;
}

function headerColumns(worksheet: XlsxWorksheet): Map<string, number> {
  const columns = new Map<string, number>();
  worksheet.getRow(1).eachCell((cell, column) => columns.set(cell.text.trim(), column));
  for (const header of REQUIRED_HEADERS) {
    if (!columns.has(header)) throw new Error(`Missing required municipality workbook header: ${header}`);
  }
  return columns;
}

function cellFor(row: XlsxRow, columns: Map<string, number>, header: string): XlsxCell {
  const column = columns.get(header);
  if (!column) throw new Error(`Missing column for ${header}`);
  return row.getCell(column);
}

export function municipalityCode(countyCode: number, localCode: number): string {
  return `${String(countyCode).padStart(2, "0")}${String(localCode).padStart(2, "0")}`;
}

export async function parseMunicipalityWorkbook(path: string): Promise<MunicipalityElectionResult[]> {
  const workbook = await readXlsxWorkbook(path);
  const countsSheet = workbook.getWorksheet("R antal");
  const percentagesSheet = workbook.getWorksheet("R procent");
  if (!countsSheet || !percentagesSheet) throw new Error("Expected the R antal and R procent worksheets");

  const countColumns = headerColumns(countsSheet);
  const percentageColumns = headerColumns(percentagesSheet);
  if (countsSheet.rowCount !== percentagesSheet.rowCount) throw new Error("Municipality worksheet row counts do not match");

  const municipalities: MunicipalityElectionResult[] = [];
  const seenCodes = new Set<string>();

  for (let rowNumber = 2; rowNumber <= countsSheet.rowCount; rowNumber += 1) {
    const countRow = countsSheet.getRow(rowNumber);
    const percentageRow = percentagesSheet.getRow(rowNumber);
    const countyCode = numberFromCell(cellFor(countRow, countColumns, "LÄNSKOD"));
    const localCode = numberFromCell(cellFor(countRow, countColumns, "KOMMUNKOD"));
    const code = municipalityCode(countyCode, localCode);
    const name = cellFor(countRow, countColumns, "KOMMUNNAMN").text.trim();

    if (!name) throw new Error(`Municipality row ${rowNumber} has no name`);
    if (seenCodes.has(code)) throw new Error(`Duplicate municipality code ${code}`);
    seenCodes.add(code);

    const validVotes = numberFromCell(cellFor(countRow, countColumns, "RÖSTER GILTIGA"));
    const totalVotes = numberFromCell(cellFor(countRow, countColumns, "RÖSTANDE"));
    const eligibleVoters = numberFromCell(cellFor(countRow, countColumns, "RÖSTBERÄTTIGADE"));
    const turnout = numberFromCell(cellFor(countRow, countColumns, "VALDELTAGANDE"));
    const parliamentaryVotes = Object.fromEntries(
      PARLIAMENTARY_PARTIES.map((partyId) => [partyId, numberFromCell(cellFor(countRow, countColumns, partyId))]),
    ) as Record<Exclude<PartyId, "OTHER">, number>;
    const otherVotes = validVotes - Object.values(parliamentaryVotes).reduce((sum, votes) => sum + votes, 0);
    if (otherVotes < 0) throw new Error(`${name} has more canonical party votes than valid votes`);

    const votesByParty = { ...parliamentaryVotes, OTHER: otherVotes } satisfies Record<PartyId, number>;
    const parties = PARTY_IDS.map((partyId) => {
      const share = round((votesByParty[partyId] / validVotes) * 100);
      if (partyId !== "OTHER") {
        const publishedShare = numberFromCell(cellFor(percentageRow, percentageColumns, partyId));
        if (share !== publishedShare) {
          throw new Error(`${name} ${partyId} share ${share} does not match published ${publishedShare}`);
        }
      }
      return { partyId, votes: votesByParty[partyId], share };
    });

    const publishedTurnout = numberFromCell(cellFor(percentageRow, percentageColumns, "VALDELTAGANDE"));
    if (turnout !== publishedTurnout || turnout !== round((totalVotes / eligibleVoters) * 100)) {
      throw new Error(`${name} turnout does not reconcile`);
    }

    municipalities.push({ code, name, validVotes, totalVotes, eligibleVoters, turnout, parties });
  }

  return municipalities.sort((left, right) => left.code.localeCompare(right.code));
}
