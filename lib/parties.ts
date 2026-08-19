export type Party = {
  id: string;
  shortName: string;
  name: string;
  color: string;
  logo: string;
  logoSource: string;
};

// Logo files are intentionally local assets. Official artwork will be added from each
// party's published media/brand resources after provenance and usage terms are recorded.
export const parties: Party[] = [
  { id: "s", shortName: "S", name: "Socialdemokraterna", color: "#E8112D", logo: "/parties/s.svg", logoSource: "official-party-asset" },
  { id: "sd", shortName: "SD", name: "Sverigedemokraterna", color: "#DDDD00", logo: "/parties/sd.svg", logoSource: "official-party-asset" },
  { id: "m", shortName: "M", name: "Moderaterna", color: "#52BDEC", logo: "/parties/m.svg", logoSource: "official-party-asset" },
  { id: "v", shortName: "V", name: "Vänsterpartiet", color: "#DA291C", logo: "/parties/v.svg", logoSource: "official-party-asset" },
  { id: "c", shortName: "C", name: "Centerpartiet", color: "#009933", logo: "/parties/c.svg", logoSource: "official-party-asset" },
  { id: "kd", shortName: "KD", name: "Kristdemokraterna", color: "#000077", logo: "/parties/kd.svg", logoSource: "official-party-asset" },
  { id: "mp", shortName: "MP", name: "Miljöpartiet", color: "#83CF39", logo: "/parties/mp.svg", logoSource: "official-party-asset" },
  { id: "l", shortName: "L", name: "Liberalerna", color: "#006AB3", logo: "/parties/l.svg", logoSource: "official-party-asset" },
];