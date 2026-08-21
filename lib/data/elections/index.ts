import electionJson from "@/data/normalized/riksdag-2022.json";
import historyJson from "@/data/normalized/riksdag-national-history.json";
import municipalityHistoryJson from "@/data/normalized/riksdag-municipalities-2018.json";
import { PARTY_ORDER } from "./parties";
import type { AreaResult, MunicipalityElectionResult, MunicipalityHistoryData, NationalHistoryData, NormalizedRiksdagData, PartyId, PartyResult } from "./types";

export const riksdag2022 = electionJson as NormalizedRiksdagData;
export const nationalHistory = historyJson as NationalHistoryData;
export const municipalityHistory2018 = municipalityHistoryJson as MunicipalityHistoryData;

export function getPartyResult(area: Pick<AreaResult, "name" | "parties"> | MunicipalityElectionResult, partyId: PartyId): PartyResult {
  const result = area.parties.find((party) => party.partyId === partyId);
  if (!result) throw new Error(`Missing ${partyId} result for ${area.name}`);
  return result;
}

export type MunicipalityComparison = {
  code: string;
  name: string;
  previous: MunicipalityElectionResult;
  current: AreaResult;
  turnoutChange: number;
  swings: Record<PartyId, number>;
};

export function getMunicipalityComparisons(): MunicipalityComparison[] {
  const previousByCode = new Map(municipalityHistory2018.municipalities.map((municipality) => [municipality.code, municipality]));
  return riksdag2022.municipalities.map((current) => {
    const previous = previousByCode.get(current.code);
    if (!previous || previous.name !== current.name) throw new Error(`Incomparable municipality observation for ${current.code} ${current.name}`);
    return {
      code: current.code,
      name: current.name,
      previous,
      current,
      turnoutChange: Number((current.turnout - previous.turnout).toFixed(2)),
      swings: Object.fromEntries(
        PARTY_ORDER.map((partyId) => [partyId, Number((getPartyResult(current, partyId).share - getPartyResult(previous, partyId).share).toFixed(2))]),
      ) as Record<PartyId, number>,
    };
  });
}

export type MunicipalityBreadth = {
  partyId: PartyId;
  improved: number;
  declined: number;
  unchanged: number;
  comparable: number;
  breadth: number;
};

export function getMunicipalityBreadth(): MunicipalityBreadth[] {
  const comparisons = getMunicipalityComparisons();
  return PARTY_ORDER.map((partyId) => {
    const swings = comparisons.map((comparison) => comparison.swings[partyId]);
    const improved = swings.filter((swing) => swing > 0).length;
    const declined = swings.filter((swing) => swing < 0).length;
    const unchanged = swings.length - improved - declined;
    return {
      partyId,
      improved,
      declined,
      unchanged,
      comparable: swings.length,
      breadth: Number(((improved / swings.length) * 100).toFixed(1)),
    };
  }).sort((left, right) => right.improved - left.improved || left.partyId.localeCompare(right.partyId));
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
  geographicBreadth: MunicipalityBreadth;
};

export function getPartyProfiles(): PartyProfile[] {
  const breadthByParty = new Map(getMunicipalityBreadth().map((breadth) => [breadth.partyId, breadth]));
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
      geographicBreadth: breadthByParty.get(partyId)!,
    };
  });
}
