import type { PartyId } from "@/lib/data/elections/types";

export const SIMULATOR_PARTY_IDS = ["S", "SD", "M", "V", "C", "KD", "MP", "L"] as const;

export type SimulatorPartyId = Exclude<PartyId, "OTHER">;
export type SimulatorPartyVotes = Record<SimulatorPartyId, number>;
export type SimulatorPartySeats = Record<SimulatorPartyId, number>;

export type RiksdagConstituencyInput = {
  code: string;
  name: string;
  validVotes: number;
  fixedSeats: number;
  partyVotes: SimulatorPartyVotes;
};

export type RiksdagElectionInput = {
  nationalValidVotes: number;
  constituencies: RiksdagConstituencyInput[];
};

export type ThresholdStatus = "national" | "constituency" | "below";

export type SeatAward = {
  kind: "fixed" | "reallocated-fixed" | "adjustment";
  constituencyCode: string;
  constituencyName: string;
  partyId: SimulatorPartyId;
  divisor: number;
  quotient: number;
};

export type PartySeatAllocation = {
  partyId: SimulatorPartyId;
  votes: number;
  share: number;
  thresholdStatus: ThresholdStatus;
  fixedSeats: number;
  adjustmentSeats: number;
  totalSeats: number;
};

export type RiksdagSeatResult = {
  rulesVersion: string;
  totalSeats: number;
  fixedSeats: number;
  adjustmentSeats: number;
  majoritySeats: number;
  returnedFixedSeats: number;
  localThresholdSeats: number;
  tieBreaks: string[];
  parties: PartySeatAllocation[];
  awards: SeatAward[];
};

export type BacktestExpectation = {
  fixed: SimulatorPartySeats;
  adjustment: SimulatorPartySeats;
  total: SimulatorPartySeats;
};

export type RiksdagBacktest = {
  year: 2018 | 2022;
  nationalValidVotes: number;
  constituencies: RiksdagConstituencyInput[];
  expected: BacktestExpectation;
};

export type RiksdagSimulatorData = {
  schemaVersion: 1;
  source: {
    publisher: "Valmyndigheten";
    retrievedAt: string;
    classification: "OFFICIAL";
    sourcePage: string;
    sources: { id: string; url: string; sha256?: string }[];
  };
  rules: {
    version: string;
    totalSeats: number;
    fixedSeats: number;
    adjustmentSeats: number;
    majoritySeats: number;
    nationalThreshold: number;
    constituencyThreshold: number;
    firstDivisor: number;
    lawUrl: string;
    methodUrl: string;
    manualUrl: string;
  };
  backtests: RiksdagBacktest[];
  scenario: {
    baselineElection: 2022;
    fixedSeatElection: 2026;
    fixedSeatsByConstituency: Record<string, number>;
  };
};
