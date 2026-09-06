import { PARTY_IDS, type PartyId } from "../elections/types";
import { VALMYNDIGHETEN_PARTY_NAMES } from "../elections/parties";
import { roundLocal, validateObservation } from "../geography/local-math";
import type { LocalArea, LocalObservation, LocalYear } from "../geography/local-types";
import { readXlsxWorkbook, type XlsxWorksheet } from "./xlsx";

const MAIN = PARTY_IDS.filter(p => p !== "OTHER");
const emptyVotes = () => Object.fromEntries(PARTY_IDS.map(p => [p, 0])) as Record<PartyId, number>;
function integer(value: string): number {
  if (!/^\d+$/.test(value.trim())) throw new Error(`Expected vote count, got ${value}`);
  const n = Number(value); if (!Number.isSafeInteger(n)) throw new Error("Unsafe count"); return n;
}
function observation(year: LocalYear, valid: string, total: string, eligible: string, votes: Record<PartyId, number>): LocalObservation {
  const validVotes = integer(valid);
  votes.OTHER = validVotes - MAIN.reduce((sum, p) => sum + votes[p], 0);
  const result = { year, validVotes, totalVotes: integer(total), eligibleVoters: integer(eligible), votes };
  validateObservation(result); return result;
}
function headers(sheet: XlsxWorksheet, required: string[]): Map<string, number> {
  const cols = new Map<string, number>(); sheet.getRow(1).eachCell((c, i) => cols.set(c.text.trim(), i));
  for (const key of required) if (!cols.has(key)) throw new Error(`Missing ${key} in district workbook`);
  return cols;
}

export function parseLocalMunicipalityCsv(text: string, year: 2010 | 2014): LocalArea[] {
  const [header, ...lines] = text.trim().split(/\r?\n/); const columns = header.split(";");
  const required = ["LAN", "KOM", "KOMMUN", "Rost Giltiga", "Rostande", "Rostb", "VDT", ...MAIN.flatMap(p => [`${p === "L" ? "FP" : p} tal`, `${p === "L" ? "FP" : p} proc`])];
  for (const key of required) if (!columns.includes(key)) throw new Error(`Missing historical column ${key}`);
  const seen = new Set<string>();
  return lines.filter(Boolean).map(line => {
    const cells = line.split(";"); if (cells.length !== columns.length) throw new Error("Invalid historical CSV row");
    const cell = (key: string) => cells[columns.indexOf(key)].trim();
    const county = cell("LAN").padStart(2, "0"); const code = county + cell("KOM").padStart(2, "0");
    if (!/^\d{4}$/.test(code) || seen.has(code) || !cell("KOMMUN")) throw new Error(`Invalid/duplicate municipality ${code}`);
    seen.add(code);
    const votes = emptyVotes(); for (const p of MAIN) votes[p] = integer(cell(`${p === "L" ? "FP" : p} tal`));
    const result = observation(year, cell("Rost Giltiga"), cell("Rostande"), cell("Rostb"), votes);
    for (const p of MAIN) if (Math.abs(roundLocal(votes[p] / result.validVotes * 100) - Number(cell(`${p === "L" ? "FP" : p} proc`).replace(",", "."))) > 0.001) throw new Error(`${code} ${p} historical share mismatch`);
    if (Math.abs(roundLocal(result.totalVotes / result.eligibleVoters * 100) - Number(cell("VDT").replace(",", "."))) > 0.001) throw new Error(`${code} historical turnout mismatch`);
    return { code, name: cell("KOMMUN"), parent: county, level: "municipality", results: [result] };
  });
}

export async function parseLocalDistricts2018(path: string): Promise<LocalArea[]> {
  const workbook = await readXlsxWorkbook(path); const sheet = workbook.getWorksheet("R antal");
  if (!sheet) throw new Error("Missing 2018 district counts");
  const cols = headers(sheet, ["LÄNSKOD", "KOMMUNKOD", "VALDISTRIKTSKOD", "VALDISTRIKTSNAMN", "RÖSTER GILTIGA", "RÖSTANDE", "RÖSTBERÄTTIGADE", ...MAIN]);
  const areas: LocalArea[] = []; const seen = new Set<string>();
  for (let row = 2; row <= sheet.rowCount; row++) {
    const cell = (key: string) => sheet.getRow(row).getCell(cols.get(key)!).text.trim();
    const parent = cell("LÄNSKOD").padStart(2, "0") + cell("KOMMUNKOD").padStart(2, "0");
    const code = parent + cell("VALDISTRIKTSKOD").padStart(4, "0");
    if (!/^\d{8}$/.test(code) || seen.has(code)) throw new Error(`Invalid/duplicate district ${code}`); seen.add(code);
    const votes = emptyVotes(); for (const p of MAIN) votes[p] = integer(cell(p) || "0"); // XLSX omits zero-valued party cells.
    const result = observation(2018, cell("RÖSTER GILTIGA"), cell("RÖSTANDE"), cell("RÖSTBERÄTTIGADE"), votes);
    areas.push({ code, name: cell("VALDISTRIKTSNAMN"), parent, level: result.eligibleVoters === 0 ? "collection" : "district", results: [result] });
  }
  return areas;
}

export async function parseLocalDistricts2022(path: string): Promise<LocalArea[]> {
  const workbook = await readXlsxWorkbook(path); const sheet = workbook.getWorksheet("roster_RD");
  if (!sheet) throw new Error("Missing roster_RD");
  const cols = headers(sheet, ["Val", "Distrikt", "Län", "Kommun", "Valdistriktskod", "Valdistriktnamn", "Valkretskod", "Parti", "Röster", "Röstberättigade"]);
  const areas = new Map<string, LocalArea>(); const seen = new Set<string>();
  for (let row = 2; row <= sheet.rowCount; row++) {
    const cell = (key: string) => sheet.getRow(row).getCell(cols.get(key)!).text.trim();
    if (cell("Val") !== "RD") throw new Error("Mixed election type in roster_RD");
    const code = cell("Valdistriktskod");
    if (!/^\d{6}(\d{2})?$/.test(code)) throw new Error(`Invalid district code ${code}`);
    const name = cell("Valdistriktnamn"); const partyName = cell("Parti");
    const constituency = cell("Valkretskod");
    if (!/^\d{2}$/.test(constituency)) throw new Error("Invalid Riksdag constituency");
    const area = areas.get(code) ?? { code, name, level: code.length === 6 ? "collection" : "district", parent: code.slice(0, 4), constituencies: [constituency], results: [{ year: 2022, validVotes: 0, totalVotes: 0, eligibleVoters: 0, votes: emptyVotes() }] };
    if (area.constituencies?.[0] !== constituency) throw new Error(`Mixed constituency district ${code}`);
    if (area.name !== name) throw new Error(`Conflicting district names ${code}`);
    const key = `${code}:${partyName}`; if (seen.has(key)) throw new Error(`Duplicate district/party row ${key}`); seen.add(key);
    const result = area.results[0]; const votes = integer(cell("Röster")); const party = VALMYNDIGHETEN_PARTY_NAMES[partyName];
    if (party) result.votes[party] = votes;
    else if (partyName === "Summa giltiga röster") result.validVotes = votes;
    else if (partyName === "Valdeltagande") { result.totalVotes = votes; result.eligibleVoters = integer(cell("Röstberättigade")); }
    areas.set(code, area);
  }
  for (const area of areas.values()) {
    if (!seen.has(`${area.code}:Summa giltiga röster`) || !seen.has(`${area.code}:Valdeltagande`)) throw new Error(`Incomplete district ${area.code}`);
    area.results[0].votes.OTHER = area.results[0].validVotes - MAIN.reduce((sum, p) => sum + area.results[0].votes[p], 0);
    validateObservation(area.results[0]);
  }
  return [...areas.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export async function parseDistrictComparison(path: string): Promise<Map<string, string[]>> {
  const workbook = await readXlsxWorkbook(path); const sheet = workbook.getWorksheet("Fysiska valdistrikt");
  if (!sheet) throw new Error("Missing official district comparisons");
  const cols = headers(sheet, ["Kod_2022", "Jämförbart", "Valdistriktskod2018", "Kod 2 2018", "Kod 3 2018"]);
  const mappings = new Map<string, string[]>();
  for (let i = 2; i <= sheet.rowCount; i++) {
    const cell = (k: string) => sheet.getRow(i).getCell(cols.get(k)!).text.trim(); const code = cell("Kod_2022");
    if (!/^\d{8}$/.test(code) || mappings.has(code)) throw new Error(`Invalid/duplicate comparison ${code}`);
    const status = cell("Jämförbart");
    if (status !== "ja" && status !== "nej" && !/^\d{8}(, ?\d{8})*$/.test(status)) throw new Error(`Unknown comparison status ${status}`);
    const previous = [cell("Valdistriktskod2018"), cell("Kod 2 2018"), cell("Kod 3 2018")].filter(Boolean);
    if (previous.some(c => !/^\d{8}$/.test(c)) || new Set(previous).size !== previous.length) throw new Error(`Invalid previous district ${code}`);
    if (status !== "nej" && !previous.length) throw new Error(`Comparable district lacks a mapping ${code}`);
    mappings.set(code, status === "nej" ? [] : previous);
  }
  return mappings;
}
