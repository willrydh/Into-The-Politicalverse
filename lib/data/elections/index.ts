import electionJson from "@/data/normalized/riksdag-2022.json";
import historyJson from "@/data/normalized/riksdag-national-history.json";
import { PARTY_ORDER } from "./parties";
import type { AreaResult, NationalHistoryData, NormalizedRiksdagData, PartyId, PartyResult } from "./types";

export const riksdag2022 = electionJson as NormalizedRiksdagData;
export const nationalHistory = historyJson as NationalHistoryData;

export function getPartyResult(area: AreaResult, partyId: PartyId): PartyResult {
  const result = area.parties.find((party) => party.partyId === partyId);
  if (!result) throw new Error(`Missing ${partyId} result for ${area.name}`);
  return result;
}

export function getElection(year: number) {
  const election = nationalHistory.elections.find((item) => item.year === year);
  if (!election) throw new Error(`Election ${year} is not available`);
  return election;
}

export function getNationalRanking(year = 2022): PartyResult[] {
  const election = getElection(year);
  return PARTY_ORDER.map((partyId) => getPartyResult(election, partyId)).sort((a, b) => b.share - a.share);
}

export function getPartyChange(partyId: PartyId, fromYear = 2018, toYear = 2022): number {
  return Number((getPartyResult(getElection(toYear), partyId).share - getPartyResult(getElection(fromYear), partyId).share).toFixed(2));
}

export function getMunicipalityLeaders(): { partyId: PartyId; count: number; share: number }[] {
  const counts = new Map<PartyId, number>();

  for (const municipality of riksdag2022.municipalities) {
    const winner = municipality.parties
      .filter((party) => party.partyId !== "OTHER")
      .sort((left, right) => right.share - left.share)[0];
    counts.set(winner.partyId, (counts.get(winner.partyId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([partyId, count]) => ({ partyId, count, share: Number(((count / riksdag2022.municipalities.length) * 100).toFixed(1)) }))
    .sort((left, right) => right.count - left.count);
}

export type PartyProfile = {
  partyId: PartyId;
  current: PartyResult;
  change: number;
  history: { year: number; share: number }[];
  strongestMunicipalities: { name: string; share: number }[];
  weakestMunicipalities: { name: string; share: number }[];
};

export function getPartyProfiles(): PartyProfile[] {
  return PARTY_ORDER.filter((partyId) => partyId !== "OTHER").map((partyId) => {
    const municipalities = riksdag2022.municipalities
      .map((area) => ({ name: area.name, share: getPartyResult(area, partyId).share }))
      .sort((left, right) => right.share - left.share);

    return {
      partyId,
      current: getPartyResult(riksdag2022.national, partyId),
      change: getPartyChange(partyId),
      history: nationalHistory.elections.map((election) => ({ year: election.year, share: getPartyResult(election, partyId).share })),
      strongestMunicipalities: municipalities.slice(0, 3),
      weakestMunicipalities: municipalities.slice(-3).reverse(),
    };
  });
}
