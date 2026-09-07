import type { PartyId } from "../data/elections/types";

// Verified against ballot-list prefixes (2010–2018) and PARTIKOD (2022).
const PARTY_CODES: Readonly<Record<string, PartyId>> = {
  "0001": "M", "0002": "S", "0003": "L", "0004": "C", "0005": "V",
  "0055": "MP", "0068": "KD", "0110": "SD",
};

export const candidatePartyId = (sourceCode: string): PartyId => PARTY_CODES[sourceCode] ?? "OTHER";
