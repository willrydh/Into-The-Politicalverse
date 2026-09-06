export type CountingStage = "preliminary" | "final-count";
export type FeedMode = "production" | "rehearsal";

export type LiveParty = {
  code: string;
  abbreviation: string;
  name: string;
  votes: number;
  share: number | null;
  seats: number | null;
  fixedSeats: number | null;
  adjustmentSeats: number | null;
};

export type LiveArea = {
  code: string;
  name: string;
  countedDistricts: number;
  totalDistricts: number;
  validVotes: number;
  invalidVotes: number;
  totalVotes: number;
  eligibleVoters: number;
  eligibleInCountedDistricts: number;
  turnoutInCountedDistricts: number | null;
  parties: LiveParty[];
  otherVotes: number;
  fixedSeats: number;
};

export type LiveResult = {
  electionDate: "2026-09-13";
  classification: "OFFICIAL" | "TEST";
  stage: CountingStage;
  sourceUpdatedAt: string;
  sourceRevision: number;
  national: LiveArea;
  constituencies: LiveArea[];
  protocolUrl: string | null;
  seatCheck: { status: "matched" | "official-lot" | "not-applicable"; reason: string; tieCount: number };
  source: { adapterVersion: string; archiveUrl: string; archiveMd5: string; jsonSha256: string; certificateSha256: string; signatureVerified: true };
};

export type EarlyVoting = {
  classification: "OFFICIAL";
  retrievedAt: string;
  sourceUrl: string;
  rawSha256: string;
  lastNonzeroDate: string | null;
  receivedVotes: number;
  locations: number;
  daily: { date: string; votes: number }[];
  municipalities: { code: string; name: string; votes: number }[];
};

export type LiveFeed = {
  schemaVersion: 1;
  electionDate: "2026-09-13";
  mode: FeedMode;
  checkedAt: string;
  resultStatus: "awaiting-results" | "ok" | "degraded";
  stageStatus: Record<CountingStage, "awaiting-results" | "ok" | "error">;
  earlyVotingStatus: "ok" | "error";
  results: Record<CountingStage, LiveResult | null>;
  earlyVoting: EarlyVoting | null;
};
