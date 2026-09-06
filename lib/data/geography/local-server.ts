import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { projectLocalMap, type LocalGeometry } from "./local-projection";
import type { LocalDistrictData, LocalDistrictPayload, LocalElectionIndex, LocalIndexModel, LocalMap } from "./local-types";
import type { PersonalVoteData } from "./personal-votes";

const read = (file: string) => JSON.parse(readFileSync(join(process.cwd(), "data/normalized", file), "utf8"));
export const getLocalElectionIndex = cache((): LocalElectionIndex => read("local-election-index.json"));
const getDistricts = cache((): LocalDistrictData => read("local-election-districts.json"));
const getPaths = cache((): { maps: Record<string, LocalMap> } => read("district-paths-2022.json"));
const getPersonalVotes = cache((): PersonalVoteData => read("personal-votes-2022.json"));
export function getPersonalConstituency(code: string) {
  const data = getPersonalVotes(); const constituency = data.constituencies.find(a => a.code === code);
  if (!constituency) throw new Error(`Unknown personal-vote constituency ${code}`);
  return { schemaVersion: data.schemaVersion, electionType: data.electionType, year: data.year, level: data.level, status: data.status, source: data.source, constituency };
}

export const getLocalIndexModel = cache((): LocalIndexModel => {
  const data = getLocalElectionIndex();
  const geometry = read("municipality-boundaries-2022.geojson") as { features: Array<{ properties: { code: string }; geometry: LocalGeometry }> };
  const features = geometry.features.map(f => ({ code: f.properties.code, geometry: f.geometry }));
  const national = projectLocalMap(features, Math.cos(62 * Math.PI / 180));
  const countyPaths = data.counties.map(c => ({ code: c.code, path: national.areas.filter(a => a.code.startsWith(c.code)).map(a => a.path).join("") }));
  return { ...data, constituencies: getPersonalVotes().constituencies.map(c => ({ code: c.code, name: c.name })), map: { ...national, areas: countyPaths }, countyMaps: Object.fromEntries(data.counties.map(c => [c.code, projectLocalMap(features.filter(f => f.code.startsWith(c.code)), Math.cos(62 * Math.PI / 180))])) };
});

export function getLocalDistrictPayload(code: string): LocalDistrictPayload {
  const data = getDistricts(); const areas = data.municipalities[code]; const map = getPaths().maps[code];
  if (!areas || !map) throw new Error(`Unknown municipality ${code}`);
  return { schemaVersion: 1, electionType: "RD", status: "final", boundaryYear: 2022, source: data.source, municipality: code, areas, map };
}
