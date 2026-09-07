import { PARTY_IDS, type PartyId } from "../elections/types";
import { LOCAL_YEARS, type LocalElectionIndex, type LocalYear } from "./local-types";

export type LocalMetric = "share" | "swing" | "turnout";
export type LocalSelection = { county: string; municipality: string; district: string; constituency: string; candidate?: string; party: PartyId; year: LocalYear; metric: LocalMetric };
export function readLocalSelection(query: string, model: LocalElectionIndex): LocalSelection {
  const p = new URLSearchParams(query);
  const municipality = model.municipalities.find(a => a.code === p.get("municipality"));
  const county = municipality?.parent ?? model.counties.find(a => a.code === p.get("county"))?.code ?? "";
  const party = p.get("party") as PartyId; const metric = p.get("metric"); const year = Number(p.get("year")) as LocalYear;
  const district = p.get("district") ?? "";
  const constituency = p.get("constituency") ?? "";
  const candidate = p.get("candidate") ?? "";
  return { county, municipality: municipality?.code ?? "", district: municipality && (district.startsWith(municipality.code) && /^\d{8}$/.test(district) || district === `${municipality.code}-collection`) ? district : "", constituency: model.national.constituencies?.includes(constituency) ? constituency : "", ...(/^\d{4}:\d+$/.test(candidate) ? { candidate } : {}), party: PARTY_IDS.includes(party) ? party : "S", metric: metric === "swing" || metric === "turnout" ? metric : "share", year: LOCAL_YEARS.includes(year) ? year : 2022 };
}
export function localSelectionQuery(selection: LocalSelection): string {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(selection)) if (value !== "") p.set(key, String(value));
  return `?${p.toString()}`;
}
