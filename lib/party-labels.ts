import { PARTIES } from "./parties";
import type { PartyId } from "./data/elections/types";

export function partyDisplayName(partyId: PartyId, year?: number): string {
  return partyId === "L" && year !== undefined && year <= 2014 ? "Folkpartiet liberalerna" : PARTIES[partyId].name;
}

type PartyTextPart = { text: string; partyId?: PartyId; historical?: boolean };

/** Only for political copy, never names, source identifiers, URLs or form values. */
export function splitPartyText(text: string): PartyTextPart[] {
  const parts: PartyTextPart[] = [];
  const tokens = /(?<![\p{L}\p{N}_])(SD|MP|KD|FP|S|M|C|L|V)(?![\p{L}\p{N}_])/gu;
  let offset = 0;
  for (const match of text.matchAll(tokens)) {
    if (match.index > offset) parts.push({ text: text.slice(offset, match.index) });
    parts.push({ text: match[0], partyId: match[0] === "FP" ? "L" : match[0] as PartyId, historical: match[0] === "FP" });
    offset = match.index + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) });
  return parts;
}
