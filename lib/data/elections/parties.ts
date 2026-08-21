import type { PartyId } from "./types";
export { PARTIES, PARTY_ORDER } from "@/lib/parties";
export type { PartyDefinition } from "@/lib/parties";

export const VALMYNDIGHETEN_PARTY_NAMES: Record<string, PartyId> = {
  Moderaterna: "M",
  Centerpartiet: "C",
  "Liberalerna (tidigare Folkpartiet)": "L",
  Kristdemokraterna: "KD",
  "Arbetarepartiet-Socialdemokraterna": "S",
  Vänsterpartiet: "V",
  "Miljöpartiet de gröna": "MP",
  Sverigedemokraterna: "SD",
};
