import { getElection, getMunicipalityBreadth, getPartyChange, getPartyResult, nationalHistory } from "@/lib/data/elections";
import { PARTY_IDS, type PartyId } from "@/lib/data/elections/types";

export type Indicator = {
  id: string;
  label: string;
  value: string;
  detail: string;
  direction: "up" | "down" | "neutral";
  methodology: string;
  classification: "DERIVED";
  methodologyVersion: string;
};

function formatSigned(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)} pp`;
}

export function calculateNationalIndicators(): Indicator[] {
  const previous = getElection(2018);
  const current = getElection(2022);
  const changes = PARTY_IDS.map((partyId) => ({ partyId, change: getPartyChange(partyId) }));
  const strongest = changes.filter(({ partyId }) => partyId !== "OTHER").sort((a, b) => b.change - a.change)[0];
  const volatility = changes.reduce((sum, party) => sum + Math.abs(party.change), 0) / 2;
  const broadest = getMunicipalityBreadth().filter(({ partyId }) => partyId !== "OTHER")[0];
  const turnoutChange = current.turnout - previous.turnout;

  return [
    {
      id: "national-swing",
      label: "National swing",
      value: `${volatility.toFixed(2)} pts`,
      detail: "Total vote-share movement, 2018–2022",
      direction: "neutral",
      methodology: "Half the sum of absolute party vote-share changes across the eight parliamentary parties and Other.",
      classification: "DERIVED",
      methodologyVersion: "1.0.0",
    },
    {
      id: "electoral-momentum",
      label: "Electoral momentum",
      value: `${strongest.partyId} ${formatSigned(strongest.change)}`,
      detail: "Largest national gain in 2022",
      direction: strongest.change >= 0 ? "up" : "down",
      methodology: "The largest percentage-point gain between the final 2018 and 2022 national results.",
      classification: "DERIVED",
      methodologyVersion: "1.0.0",
    },
    {
      id: "geographic-breadth",
      label: "Geographic breadth",
      value: `${broadest.partyId} ${broadest.improved}/${broadest.comparable}`,
      detail: "Municipalities with a higher vote share, 2018–2022",
      direction: "neutral",
      methodology: "Counts comparable municipalities where each party's final Riksdag vote share increased from 2018 to 2022, without weighting municipalities by population. The displayed party improved in the most municipalities.",
      classification: "DERIVED",
      methodologyVersion: "2.0.0",
    },
    {
      id: "turnout-trend",
      label: "Turnout trend",
      value: formatSigned(turnoutChange),
      detail: `${current.turnout.toFixed(2)}% turnout in 2022`,
      direction: turnoutChange >= 0 ? "up" : "down",
      methodology: "Percentage-point change in final national turnout between the 2018 and 2022 Riksdag elections.",
      classification: "DERIVED",
      methodologyVersion: "1.0.0",
    },
  ];
}

export function effectiveNumberOfParties(year = 2022): number {
  const election = nationalHistory.elections.find((item) => item.year === year);
  if (!election) throw new Error(`Election ${year} is not available`);
  const sumOfSquares = election.parties.reduce((sum, party) => sum + (party.share / 100) ** 2, 0);
  return Number((1 / sumOfSquares).toFixed(2));
}

export function topTwoConcentration(year = 2022): number {
  const election = getElection(year);
  const shares = election.parties.map((party) => party.share).sort((a, b) => b - a);
  return Number((shares[0] + shares[1]).toFixed(2));
}

export function partyRelativeStrength(partyId: PartyId, areaShare: number): number {
  const nationalShare = getPartyResult(getElection(2022), partyId).share;
  return Number((areaShare / nationalShare).toFixed(2));
}
