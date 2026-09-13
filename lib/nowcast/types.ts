import type { PartyId } from "../data/elections/types";
export const NOWCAST_VERSION = "pv-nowcast-2.0.0";
export const PROBABILITY_VERSION = "pv-nowcast-majority-2.0.0";
export type MajorityProbability = {
  methodVersion: string;
  calibration: "unvalidated";
  definition: "175-of-349";
  simulations: number;
  seed: number;
  noiseFloorPp: number;
  stressScenarios: number;
  localResidualGroups: number;
  turnoutLogSd: number;
  leftWins: number;
  rightWins: number;
  unresolved: number;
};
export const NOWCAST_PARTIES = [
  "M",
  "C",
  "L",
  "KD",
  "S",
  "V",
  "MP",
  "SD",
  "OTHER",
] as const;
export type Votes = Record<PartyId, number>;
export type BaselineUnit = {
  code: string;
  municipality: string;
  constituency: string;
  eligible: number;
  baselineEligible: number;
  votes: Votes;
  matched: boolean;
  collection: boolean;
};
export type Observation = {
  code: string;
  municipality: string;
  constituency: string;
  eligible: number | null;
  votes: Votes;
  reported: boolean;
  collection: boolean;
};
export type NowcastEstimate = {
  classification: "MODEL";
  methodVersion: string;
  baselineYear: 2022;
  status: "insufficient" | "experimental" | "counted";
  matchedDistricts: number;
  representedConstituencies: number;
  matchedCoverage: number;
  comparableReportedShare: number;
  countedDistricts: number;
  totalDistricts: number;
  countedVotes: number;
  estimatedRemainingVotes: number;
  estimatedCollectionVotes: number;
  imputedRemainingVoteShare: number;
  diagnostics?: import("./adaptive-swing").SwingDiagnostics;
  probability?: MajorityProbability;
  rows: {
    partyId: PartyId;
    countedVotes: number;
    countedShare: number | null;
    projectedVotes: number;
    projectedShare: number;
    sensitivity: [number, number];
    seats: number | null;
  }[];
};
export type NowcastEnvelope = {
  methodVersion: string;
  status: "waiting" | "ready" | "error";
  checkedAt: string;
  source?: {
    archiveMd5: string;
    jsonSha256: string;
    revision: number;
    updatedAt: string;
    baselineSha256: string;
  };
  estimate?: NowcastEstimate;
};
export type StressReport = {
  methodVersion: string;
  scope: string;
  districts: number;
  orders: string[];
  checkpoints: {
    coverage: number;
    rawMae: number;
    modelMae: number;
    maxPartyError: Votes;
    remainingShareErrors: Votes[];
  }[];
};
