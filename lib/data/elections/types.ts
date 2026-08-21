export const PARTY_IDS = ["M", "C", "L", "KD", "S", "V", "MP", "SD", "OTHER"] as const;

export type PartyId = (typeof PARTY_IDS)[number];

export type PartyResult = {
  partyId: PartyId;
  votes: number;
  share: number;
  seats?: number;
};

export type AreaResult = {
  code: string;
  name: string;
  districtCount: number;
  validVotes: number;
  totalVotes: number;
  eligibleVoters: number;
  turnout: number;
  parties: PartyResult[];
};

export type HistoricalElection = AreaResult & {
  year: number;
  electionDate: string;
};

export type NormalizedRiksdagData = {
  schemaVersion: 1;
  source: {
    publisher: string;
    dataset: string;
    sourceUrl: string;
    sourceSha256: string;
    retrievedAt: string;
    attribution: string;
    classification: "OFFICIAL";
  };
  election: {
    year: 2022;
    electionDate: string;
    type: "RD";
    status: "final";
  };
  national: AreaResult;
  constituencies: AreaResult[];
  municipalities: AreaResult[];
};

export type NationalHistoryData = {
  schemaVersion: 1;
  source: {
    publisher: string;
    dataset: string;
    attribution: string;
    retrievedAt: string;
    classification: "OFFICIAL";
    urls: { year: number; url: string }[];
  };
  elections: HistoricalElection[];
};
