import type { CountingStage, LiveArea, LiveResult } from "./types";

export const AREA_METHOD = "pv-election-areas-1.0.0";
export const AREA_FEED_URL = "https://raw.githubusercontent.com/willrydh/Into-The-Politicalverse/live-data/area-results-2026.json";
export type ElectionType = "RD" | "RF" | "KF";
export type CountedArea = Omit<LiveArea, "fixedSeats"> & { sourceWarnings?: ("previous-party-total" | "missing-counted-electorate")[] };
export type AreaResult = {
  electionType: ElectionType;
  stage: CountingStage;
  sourceUpdatedAt: string;
  sourceRevision: number;
  area: CountedArea;
  totalSeats: number;
  protocolUrl: string | null;
  municipalities: (CountedArea & { countyCode: string })[];
  source: LiveResult["source"];
  summarySource: LiveResult["source"] | null;
};
export type AreaFeed = {
  schemaVersion: 1;
  methodVersion: typeof AREA_METHOD;
  classification: "OFFICIAL";
  electionDate: "2026-09-13";
  checkedAt: string;
  indexSha256: string | null;
  status: "ok" | "degraded";
  published: Record<CountingStage, Record<ElectionType, number>>;
  failures: string[];
  results: Record<string, AreaResult>;
};
export const areaKey = (type: ElectionType, code: string, stage: CountingStage) => `${stage}/${type}/${code}`;

export function selectAreaResult(feed: AreaFeed, type: ElectionType, code: string, stage?: CountingStage): AreaResult | null {
  if (stage) return feed.results[areaKey(type, code, stage)] ?? null;
  const p = feed.results[areaKey(type, code, "preliminary")], f = feed.results[areaKey(type, code, "final-count")];
  return f && f.area.validVotes > 0 && (f.area.countedDistricts === f.area.totalDistricts || !p) ? f : p ?? null;
}

export function areaIsEstablished(r: AreaResult): boolean {
  return r.stage === "final-count" && r.area.totalDistricts > 0 && r.area.countedDistricts === r.area.totalDistricts && r.area.validVotes > 0 && r.protocolUrl !== null && r.area.parties.every(p => p.seats !== null) && r.area.parties.reduce((s, p) => s + (p.seats ?? 0), 0) === r.totalSeats;
}
