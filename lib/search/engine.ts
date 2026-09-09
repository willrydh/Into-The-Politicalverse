import { SEARCH_TYPES, type SearchEntry, type SearchIndex, type SearchType } from "./types";

export function normalizeSearch(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("sv").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

export function safeSearchHref(href: unknown): href is string {
  return typeof href === "string" && /^\/(?:maps|parties|elections|forecasts|charts|indicators|simulator|valnatt|sources|overview|search|rankings|people|press|privacy)?\/?(?:[?#][^\s<>]*)?$/.test(href) && !/[\\\u0000-\u001f]/.test(href);
}
export function validateSearchIndex(value: unknown): asserts value is SearchIndex {
  const data = value as SearchIndex;
  if (!data || data.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(data.version) || !Array.isArray(data.entries) || !data.entries.length) throw new Error("Invalid search index");
  const ids = new Set<string>();
  const text = (v: unknown) => !!v && typeof (v as { sv: unknown }).sv === "string" && typeof (v as { en: unknown }).en === "string";
  for (const e of data.entries) {
    if (!e || typeof e.id !== "string" || ids.has(e.id) || !SEARCH_TYPES.includes(e.type) || !text(e.title) || !e.title.sv || !e.title.en || !text(e.description) || !safeSearchHref(e.href) || (e.keywords !== undefined && typeof e.keywords !== "string")) throw new Error("Invalid search entry");
    if (e.links !== undefined && (!Array.isArray(e.links) || e.links.some(l => !l || !text(l.title) || !safeSearchHref(l.href) || (l.keywords !== undefined && typeof l.keywords !== "string")))) throw new Error("Invalid search destination");
    if (e.priority !== undefined && (!Number.isInteger(e.priority) || e.priority < 0 || e.priority > 20)) throw new Error("Invalid search priority");
    ids.add(e.id);
  }
}

export type PreparedSearchEntry = {
  id: string; type: SearchType; title: string; priority: number;
  titles: string[]; words: string[]; context: string; contextWords: string;
  readonly entry: SearchEntry;
};

export function prepareSearch(entries: SearchEntry[]): PreparedSearchEntry[] {
  return entries.map(entry => {
    const titles = [...new Set([entry.title.sv, entry.title.en].map(normalizeSearch))];
    const words = [...new Set(titles.flatMap(s => s.split(" ")))];
    const context = normalizeSearch([entry.description.sv, entry.description.en, entry.keywords, ...(entry.links ?? []).flatMap(l => [l.title.sv, l.title.en, l.keywords])].join(" "));
    return { id: entry.id, type: entry.type, title: entry.title.sv, priority: entry.priority ?? 0, entry, titles, words, context, contextWords: ` ${context} ` };
  });
}

// One insertion, deletion, replacement or adjacent transposition; only for name
// tokens of four or more letters, and only when no exact matches exist.
function closeWord(a: string, b: string) {
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1 || /\d/.test(a + b)) return false;
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
}

export function searchEntries(index: ReturnType<typeof prepareSearch>, rawQuery: string, type: SearchType | "all" = "all") {
  const query = normalizeSearch(rawQuery.slice(0, 160)); const tokens = query.split(" ").filter(Boolean).slice(0, 12);
  const empty = () => ({ hits: [] as Array<{ entry: SearchEntry; score: number }>, counts: Object.fromEntries(SEARCH_TYPES.map(t => [t, 0])) as Record<SearchType, number>, total: 0, approximate: false });
  if (!tokens.length) return empty();
  function rank(approximate: boolean) {
    return index.flatMap(item => {
      let score = 0;
      for (const token of tokens) {
        if (item.words.includes(token)) score += 40;
        else if (token.length > 1 && item.words.some(w => w.startsWith(token))) score += 26;
        else if (token.length > 2 && item.titles.some(t => t.includes(token))) score += 15;
        else if (item.contextWords.includes(` ${token} `)) score += 8;
        else if (token.length > 2 && item.context.includes(token)) score += 3;
        else if (approximate && item.words.some(w => closeWord(token, w))) score += 1;
        else return [];
      }
      if (item.titles.includes(query)) score += 200 + (item.type === "municipality" ? 6 : item.type === "county" ? 4 : 0);
      else if (item.titles.some(t => t.startsWith(query))) score += 80;
      // Exact party abbreviations must outrank incidental single-letter tokens.
      if (item.type === "party" && normalizeSearch(item.id.slice(6)) === query) score += 240;
      return [{ item, score }];
    }).sort((a, b) => b.score - a.score || b.item.priority - a.item.priority || a.item.title.localeCompare(b.item.title, "sv") || a.item.id.localeCompare(b.item.id));
  }
  let hits = rank(false); let approximate = false;
  if (!hits.length) { hits = rank(true); approximate = hits.length > 0; }
  const counts = empty().counts;
  for (const h of hits) counts[h.item.type]++;
  const selected = type === "all" ? hits : hits.filter(h => h.item.type === type);
  // Candidate descriptions and destination links are materialized only for the
  // displayed page, rather than for every person matching a broad query.
  return { hits: selected.map(({ item, score }) => ({ get entry() { return item.entry; }, score })), counts, total: hits.length, approximate };
}

export function preferredSearchLink(entry: SearchEntry, query: string) {
  const tokens = normalizeSearch(query).split(" ").filter(t => t.length > 2);
  return entry.links?.map(link => ({ link, score: tokens.filter(t => normalizeSearch(`${link.title.sv} ${link.title.en} ${link.keywords ?? ""}`).includes(t)).length })).sort((a, b) => b.score - a.score)[0]?.link;
}
