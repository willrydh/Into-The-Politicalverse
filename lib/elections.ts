import type { PartyId } from "@/lib/data/elections/types";

export type DataClassification = "OFFICIAL" | "DERIVED" | "MODEL";

export type DataProvenance = {
  authority: "Valmyndigheten" | "SCB" | "Politicalverse";
  dataset: string;
  sourceUrl: string;
  sourceUpdatedAt?: string;
  ingestedAt?: string;
  classification: DataClassification;
  version?: string;
};

export type ElectionResultObservation = {
  electionYear: number;
  electionType: "riksdag" | "region" | "kommun";
  geographyCode: string;
  partyId: PartyId;
  votes: number;
  voteShare: number;
  provenance: DataProvenance;
};

export const officialSources = {
  valmyndigheten2026: "https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026",
  valmyndighetenHistorical: "https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022",
  scbPxWeb: "https://www.scb.se/vara-tjanster/oppna-data/pxwebapi/",
} as const;
