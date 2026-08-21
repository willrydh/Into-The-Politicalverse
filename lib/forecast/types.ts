import type { SimulatorPartyId, SimulatorPartySeats, SimulatorPartyVotes } from "@/lib/simulator/types";

export const FORECAST_PARTY_IDS = ["S", "SD", "M", "V", "C", "KD", "MP", "L"] as const satisfies readonly SimulatorPartyId[];

export type PollHouse = string;

export type PollObservation = {
  publishedMonth: string;
  company: string;
  house: PollHouse;
  shares: Partial<SimulatorPartyVotes>;
  uncertain: number | null;
  sampleSize: number | null;
  publishedAt: string | null;
  fieldworkFrom: string | null;
  fieldworkTo: string | null;
  approximateFieldwork: boolean;
  rowNumber: number;
};

export type ForecastParty = {
  partyId: SimulatorPartyId;
  meanShare: number;
  shareInterval80: [number, number];
  centralSeats: number;
  medianSeats: number;
  seatInterval80: [number, number];
  thresholdProbability: number;
  largestPartyProbability: number;
  pollingDisagreement: number;
  historicalRmse: number;
  seatHistogram: Array<{ seats: number; probability: number }>;
};

export type ForecastCoalition = {
  id: string;
  name: string;
  partyIds: SimulatorPartyId[];
  centralSeats: number;
  majorityProbability: number;
  status: "declared" | "arithmetical" | "politically-contested";
  explanation: string;
};

export type ForecastBacktestElection = {
  year: number;
  cutoff: string;
  role: "calibration" | "holdout";
  polls: number;
  houses: number;
  meanAbsoluteError: number;
  prediction: SimulatorPartyVotes;
  actual: SimulatorPartyVotes;
};

export type ForecastTrendPoint = {
  date: string;
  oppositionSeats: number;
  tidoSeats: number;
  partyShares: SimulatorPartyVotes;
};

export type ForecastQuestion = {
  id: string;
  question: string;
  probability: number;
  resultLabel: string;
  category: "majority" | "threshold" | "party" | "parliament";
  resolution: string;
  explanation: string;
  classification: "MODEL";
};

export type ElectionForecast = {
  schemaVersion: 1;
  classification: "MODEL";
  status: "BETA";
  snapshotId: string;
  model: {
    id: "pv-election-forecast";
    version: "1.0.0-beta.1";
    averagingVersion: "pv-poll-average-1.0.0";
    generatedAt: string;
    dataCutoff: string;
    electionDate: "2026-09-13";
    horizonDays: number;
    seed: number;
    simulations: number;
    windowDays: 180;
    halfLifeDays: 28;
    approximateFieldworkWeight: 0.85;
    maximumHouseWeight: 0.25;
    uncertaintyMethod: "shrunk-nine-category-residual-covariance";
    simulationMethod: "antithetic-student-t";
    otherCategorySeatTreatment: "aggregate-assumed-seat-ineligible";
  };
  source: {
    dataset: "SwedishPolls";
    classification: "POLL";
    repositoryUrl: string;
    rawUrl: string;
    upstreamCommit: string;
    rawSha256: string;
    license: "CC0-1.0";
    retrievedAt: string;
    primaryCrossChecks: Array<{
      publisher: string;
      url: string;
      publishedAt: string;
      validated: true;
    }>;
  };
  evidence: {
    pollBankRows: number;
    pollBankStartYear: number;
    currentWindowPolls: number;
    currentWindowHouses: number;
    currentWindowInterviews: number;
    currentWindowApproximatePolls: number;
    effectivePollCount: number;
    effectiveHouseCount: number;
    maximumRealizedHouseWeight: number;
    interviewsAreNonUnique: true;
    officialHistoryElections: 6;
    comparableBacktestElections: 4;
    calibrationElections: 3;
    holdoutElections: 1;
    backtestPartyOutcomes: 32;
    excludedCoverageAuditYears: [2002, 2006];
    officialConstituencies: 29;
    officialMunicipalities: 290;
  };
  quality: {
    calibrationMeanAbsoluteError: number;
    holdoutMeanAbsoluteError: number;
    allBacktestMeanAbsoluteError: number;
    allBacktestRootMeanSquareError: number;
    leaveOneElectionOutIntervalCoverage80: number;
    intervalCalibrationScale: number;
    seatTieLotSimulations: number;
    seatTieLotRate: number;
    caveat: string;
  };
  pollingAverage: SimulatorPartyVotes & { OTHER: number };
  centralScenario: {
    seats: SimulatorPartySeats;
    majoritySeats: 175;
    oppositionSeats: number;
    tidoSeats: number;
    changeSincePreviousDataPoint: {
      date: string;
      oppositionSeatDelta: number;
      tidoSeatDelta: number;
    };
  };
  parties: ForecastParty[];
  questions: ForecastQuestion[];
  coalitions: ForecastCoalition[];
  backtests: ForecastBacktestElection[];
  trend: ForecastTrendPoint[];
};
