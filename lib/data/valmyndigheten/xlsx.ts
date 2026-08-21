import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import JSZip from "jszip";

export type XlsxCell = {
  value: string | number | null;
  text: string;
};

export class XlsxRow {
  constructor(private readonly cells: Map<number, XlsxCell>) {}

  getCell(column: number): XlsxCell {
    return this.cells.get(column) ?? { value: null, text: "" };
  }

  eachCell(callback: (cell: XlsxCell, column: number) => void): void {
    for (const [column, cell] of [...this.cells.entries()].sort(([left], [right]) => left - right)) callback(cell, column);
  }
}

export class XlsxWorksheet {
  readonly rowCount: number;

  constructor(private readonly rows: Map<number, XlsxRow>) {
    let rowCount = 0;
    for (const rowNumber of rows.keys()) rowCount = Math.max(rowCount, rowNumber);
    this.rowCount = rowCount;
  }

  getRow(row: number): XlsxRow {
    return this.rows.get(row) ?? new XlsxRow(new Map());
  }

  eachRow(callback: (row: XlsxRow, rowNumber: number) => void): void {
    for (const [rowNumber, row] of [...this.rows.entries()].sort(([left], [right]) => left - right)) callback(row, rowNumber);
  }
}

export type XlsxWorkbook = {
  getWorksheet(name: string): XlsxWorksheet | undefined;
};

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attribute(attributes: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return attributes.match(new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`))?.[1];
}

function textElements(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join("");
}

function columnNumber(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase();
  if (!letters) throw new Error(`Invalid XLSX cell reference ${reference}`);
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
}

function sheetPath(target: string): string {
  const normalized = target.replace(/^\//, "");
  return normalized.startsWith("xl/") ? normalized : posix.normalize(posix.join("xl", normalized));
}

async function zipText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`Missing ${path} in XLSX archive`);
  return file.async("text");
}

function parseWorksheet(xml: string, sharedStrings: string[]): XlsxWorksheet {
  const rows = new Map<number, XlsxRow>();
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(attribute(rowMatch[1], "r"));
    if (!Number.isInteger(rowNumber) || rowNumber < 1) throw new Error("Invalid XLSX row number");
    const cells = new Map<number, XlsxCell>();
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const reference = attribute(cellMatch[1], "r");
      if (!reference) throw new Error(`XLSX cell in row ${rowNumber} has no reference`);
      const type = attribute(cellMatch[1], "t");
      const body = cellMatch[2] ?? "";
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      let value: string | number | null = null;
      let text = "";
      if (type === "s") {
        const index = Number(raw);
        text = sharedStrings[index] ?? "";
        value = text;
      } else if (type === "inlineStr") {
        text = textElements(body);
        value = text;
      } else if (type === "str") {
        text = decodeXml(raw);
        value = text;
      } else if (raw !== "") {
        const number = Number(raw);
        value = Number.isFinite(number) ? number : decodeXml(raw);
        text = String(value);
      }
      cells.set(columnNumber(reference), { value, text });
    }
    rows.set(rowNumber, new XlsxRow(cells));
  }
  return new XlsxWorksheet(rows);
}

export async function readXlsxWorkbook(path: string): Promise<XlsxWorkbook> {
  const zip = await JSZip.loadAsync(await readFile(path));
  const workbookXml = await zipText(zip, "xl/workbook.xml");
  const relationshipsXml = await zipText(zip, "xl/_rels/workbook.xml.rels");
  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  const sharedStringsXml = sharedStringsFile ? await sharedStringsFile.async("text") : "";
  const sharedStrings = [...sharedStringsXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) => textElements(match[1]));
  const targets = new Map<string, string>();
  for (const match of relationshipsXml.matchAll(/<Relationship\b([^>]*?)(?:\/>|>[\s\S]*?<\/Relationship>)/g)) {
    const id = attribute(match[1], "Id");
    const target = attribute(match[1], "Target");
    if (id && target) targets.set(id, target);
  }

  const worksheetEntries: Array<{ name: string; path: string }> = [];
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*?)(?:\/>|>[\s\S]*?<\/sheet>)/g)) {
    const name = decodeXml(attribute(match[1], "name") ?? "");
    const relationshipId = attribute(match[1], "r:id");
    const target = relationshipId ? targets.get(relationshipId) : undefined;
    if (name && target) worksheetEntries.push({ name, path: sheetPath(target) });
  }

  const worksheets = new Map<string, XlsxWorksheet>();
  for (const entry of worksheetEntries) worksheets.set(entry.name, parseWorksheet(await zipText(zip, entry.path), sharedStrings));
  return { getWorksheet: (name) => worksheets.get(name) };
}
