import type { PartyId } from "@/lib/data/elections/types";

export type PartyDefinition = {
  id: PartyId;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  logo: string | null;
  logoSource: string | null;
};

export const PARTIES: Record<PartyId, PartyDefinition> = {
  M: { id: "M", name: "Moderaterna", shortName: "M", color: "#55b9e9", textColor: "#082131", logo: "/parties/m.png", logoSource: "https://via.tt.se/pressrum/3235744/moderaterna/m" },
  C: { id: "C", name: "Centerpartiet", shortName: "C", color: "#114838", textColor: "#ffffff", logo: "/parties/c.png", logoSource: "https://www.centerpartiet.se/om-centerpartiet/grafisk-profil" },
  L: { id: "L", name: "Liberalerna", shortName: "L", color: "#006ab3", textColor: "#ffffff", logo: "/parties/l.png", logoSource: "https://www.liberalerna.se/grafisk-profil" },
  KD: { id: "KD", name: "Kristdemokraterna", shortName: "KD", color: "#0865a0", textColor: "#ffffff", logo: "/parties/kd.png", logoSource: "https://press.kristdemokraterna.se/presskits/25663/logotyp-rund-variant-undantag-bara-i-media" },
  S: { id: "S", name: "Socialdemokraterna", shortName: "S", color: "#ed1b2f", textColor: "#ffffff", logo: "/parties/s.png", logoSource: "https://www.socialdemokraterna.se/vart-parti/press/" },
  V: { id: "V", name: "Vänsterpartiet", shortName: "V", color: "#f51b2b", textColor: "#ffffff", logo: "/parties/v.png", logoSource: "https://www.vansterpartiet.se/grafisk-profil/" },
  MP: { id: "MP", name: "Miljöpartiet", shortName: "MP", color: "#2b912c", textColor: "#ffffff", logo: "/parties/mp.png", logoSource: "https://www.mp.se/profil-och-logga/" },
  SD: { id: "SD", name: "Sverigedemokraterna", shortName: "SD", color: "#ffcf06", textColor: "#172b67", logo: "/parties/sd.png", logoSource: "https://www.sd.se/press/" },
  OTHER: { id: "OTHER", name: "Other parties", shortName: "Other", color: "#8c9189", textColor: "#ffffff", logo: null, logoSource: null },
};

export const PARTY_ORDER: PartyId[] = ["S", "SD", "M", "V", "C", "KD", "MP", "L", "OTHER"];

export const parties = PARTY_ORDER.filter((partyId) => partyId !== "OTHER").map((partyId) => PARTIES[partyId]);
