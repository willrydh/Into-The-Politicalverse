import type { PartyId } from "../elections/types";

export const LOCAL_YEARS = [2010, 2014, 2018, 2022] as const;
export type LocalYear = (typeof LOCAL_YEARS)[number];
export type LocalObservation = {
  year: LocalYear;
  validVotes: number;
  totalVotes: number;
  eligibleVoters: number;
  votes: Record<PartyId, number>;
};
export type LocalArea = {
  code: string;
  name: string;
  level: "national" | "county" | "municipality" | "district" | "collection";
  parent: string | null;
  results: LocalObservation[];
  constituencies?: string[];
  comparison?: { status: "comparable" | "not-comparable"; previousCodes: string[]; previousNames: string[]; reason?: "boundary-change" | "shared-baseline" };
};
export type LocalSources = {
  publisher: "Valmyndigheten";
  retrievedAt: string;
  methodVersion: "local-geography-1.0.0";
  sources: Array<{ file: string; url: string; sha256: string }>;
};
export type LocalElectionIndex = {
  schemaVersion: 1;
  electionType: "RD";
  status: "final";
  boundaryYear: 2022;
  source: LocalSources;
  national: LocalArea;
  counties: LocalArea[];
  municipalities: LocalArea[];
};
export type LocalDistrictData = {
  schemaVersion: 1;
  electionType: "RD";
  status: "final";
  boundaryYear: 2022;
  source: LocalSources;
  municipalities: Record<string, LocalArea[]>;
};
export type AreaPath = { code: string; path: string };
export type LocalMap = { viewBox: string; areas: AreaPath[] };
export type LocalIndexModel = LocalElectionIndex & { map: LocalMap; countyMaps: Record<string, LocalMap>; constituencies: Array<{ code: string; name: string }> };
export type LocalDistrictPayload = {
  schemaVersion: 1;
  electionType: "RD";
  status: "final";
  boundaryYear: 2022;
  source: LocalSources;
  municipality: string;
  areas: LocalArea[];
  map: LocalMap;
};
