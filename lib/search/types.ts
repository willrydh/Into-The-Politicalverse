export type SearchText = { sv: string; en: string };
export const SEARCH_TYPES = ["person", "party", "county", "municipality", "locality", "district", "constituency", "page", "election", "topic", "source"] as const;
export type SearchType = typeof SEARCH_TYPES[number];
export type SearchLink = { title: SearchText; href: string; keywords?: string };
export type SearchEntry = {
  id: string;
  type: SearchType;
  title: SearchText;
  description: SearchText;
  href: string;
  keywords?: string;
  links?: SearchLink[];
};
export type SearchIndex = { schemaVersion: 1; version: string; entries: SearchEntry[] };
export const bilingual = (sv: string, en = sv): SearchText => ({ sv, en });
