import { normalizeSearch, type PreparedSearchEntry } from "../search/engine";
import { bilingual as b, type SearchEntry } from "../search/types";
import { personHref, type CandidateElection } from "./types";

type CandidateSearchRow = [string, string, string[], number[], string[], string[]];
export type CandidateSearchIndex = {
  schemaVersion: 1; version: string;
  parties: Record<string, [string, string, string]>;
  areas: Record<string, [string, CandidateElection, string]>;
  rows: CandidateSearchRow[];
};

export function validateCandidateSearch(value: unknown): asserts value is CandidateSearchIndex {
  const d = value as CandidateSearchIndex;
  if (!d || d.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(d.version) || !Array.isArray(d.rows) || !d.parties || !d.areas) throw new Error("Invalid candidate search data");
  for (const [code, names] of Object.entries(d.parties)) {
    if (!/^\d{4}$/.test(code) || !Array.isArray(names) || names.length !== 3 || names.some(n => typeof n !== "string" || !n)) throw new Error("Invalid search party");
  }
  for (const [key, area] of Object.entries(d.areas)) {
    if (!Array.isArray(area) || area.length !== 3 || typeof area[0] !== "string" || !area[0] || !["RD", "RF", "KF"].includes(area[1]) || !/^\d{2,4}$/.test(area[2]) || key !== `${area[1]}:${area[2]}`) throw new Error("Invalid search area");
  }
  const seen = new Set<string>();
  for (const row of d.rows) {
    if (!Array.isArray(row) || row.length !== 6) throw new Error("Invalid candidate search row");
    const [id, name, aliases, years, parties, areas] = row;
    if (!/^p(?:2010|2014|2018|2022)-\d+$/.test(id) || seen.has(id) || typeof name !== "string" || !name || !Array.isArray(aliases) || aliases.some(a => typeof a !== "string") || !Array.isArray(years) || !years.length || years.some(y => ![2010, 2014, 2018, 2022].includes(y)) || !Array.isArray(parties) || !parties.length || parties.some(p => !Object.hasOwn(d.parties, p)) || !Array.isArray(areas) || !areas.length || areas.some(a => !Object.hasOwn(d.areas, a))) throw new Error("Invalid candidate search row");
    seen.add(id);
  }
}

const electionLabel = (election: CandidateElection, en = false) => election === "KF" ? (en ? "Municipal election" : "Kommunval") : election === "RF" ? (en ? "Regional election" : "Regionval") : "Riksdag";
const priority = (years: number[]) => Math.max(...years) - 2010 + years.length - 1;

function candidateSearchEntry(d: CandidateSearchIndex, row: CandidateSearchRow): SearchEntry {
  const [id, name, aliases, years, parties, areas] = row;
  const names = parties.map(p => d.parties[p]), locations = areas.map(a => d.areas[a][0]);
  const description = (language: 0 | 1) => `${names.map(p => p[language]).join(" / ")} · ${years.join(" · ")} · ${locations.slice(0, 3).join(" / ")}${locations.length > 3 ? ` +${locations.length - 3}` : ""}`;
  return {
    id: `candidate:${id}`, type: "person", priority: priority(years), title: b(name),
    description: b(description(0), description(1)), href: personHref(id),
    keywords: [...aliases, ...names.map(n => n[2]), ...locations].join(" "),
    links: areas.map(a => {
      const [name, election, code] = d.areas[a];
      return { title: b(`${name} · ${electionLabel(election)}`, `${name} · ${electionLabel(election, true)}`), href: personHref(id, election, code) };
    }),
  };
}

// Used by source coverage checks. The browser prepares the compact rows below.
export function candidateSearchEntries(value: unknown): SearchEntry[] {
  validateCandidateSearch(value);
  return value.rows.map(row => candidateSearchEntry(value, row));
}

export async function prepareCandidateSearch(value: unknown, signal?: AbortSignal): Promise<PreparedSearchEntry[]> {
  signal?.throwIfAborted();
  validateCandidateSearch(value);
  const d = value;
  // Normalize shared party and geographic labels once. Full bilingual result
  // cards and links are built only when a visible hit is read.
  const partyContext = Object.fromEntries(Object.entries(d.parties).map(([key, names]) => [key, normalizeSearch(names.join(" "))]));
  const areaContext = Object.fromEntries(Object.entries(d.areas).map(([key, [name, election]]) => [key, normalizeSearch(`${name} ${electionLabel(election)} ${electionLabel(election, true)}`)]));
  const prepared: PreparedSearchEntry[] = [];
  for (let i = 0; i < d.rows.length; i++) {
    if (i % 2048 === 0) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      signal?.throwIfAborted();
    }
    const row = d.rows[i], [id, name, aliases, years, parties, areas] = row;
    const title = normalizeSearch(name);
    const context = [normalizeSearch(aliases.join(" ")), ...years, ...parties.map(p => partyContext[p]), ...areas.map(a => areaContext[a])].join(" ");
    prepared.push({
      id: `candidate:${id}`, type: "person", title: name, priority: priority(years),
      titles: [title], words: [...new Set(title.split(" "))], context, contextWords: ` ${context} `,
      get entry() { return candidateSearchEntry(d, row); },
    });
  }
  return prepared;
}
