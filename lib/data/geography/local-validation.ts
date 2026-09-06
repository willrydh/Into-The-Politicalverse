import { sumObservations, validateObservation } from "./local-math";
import { PARTY_IDS } from "../elections/types";
import type { LocalDistrictPayload, LocalObservation } from "./local-types";
export function validateDistrictPayload(value: unknown, code: string, expected?: LocalObservation): asserts value is LocalDistrictPayload {
  const data = value as LocalDistrictPayload;
  if (!data || data.schemaVersion !== 1 || data.electionType !== "RD" || data.status !== "final" || data.boundaryYear !== 2022 || data.municipality !== code || data.source?.publisher !== "Valmyndigheten" || !Array.isArray(data.areas) || !data.map?.viewBox || !Array.isArray(data.map.areas)) throw new Error("Invalid district payload");
  const seen = new Set<string>();
  for (const area of data.areas) {
    if (area.parent !== code || seen.has(area.code) || !["district", "collection"].includes(area.level) || !area.name || !Array.isArray(area.results)) throw new Error("Invalid district identity");
    seen.add(area.code);
    if (area.results.filter(r => r.year === 2022).length !== 1 || new Set(area.results.map(r => r.year)).size !== area.results.length) throw new Error("Missing district election");
    for (const r of area.results) { if (![2018, 2022].includes(r.year)) throw new Error("Wrong district election"); validateObservation(r); }
    if (area.level === "district" && area.results.some(r => r.year === 2018) && area.comparison?.status !== "comparable") throw new Error("Unverified district history");
  }
  const physical = data.areas.filter(a => a.level === "district");
  if (data.map.areas.length !== physical.length || new Set(data.map.areas.map(a => a.code)).size !== physical.length || data.map.areas.some(a => !physical.some(d => d.code === a.code) || !/^M[\d .LMZ-]+$/.test(a.path))) throw new Error("Invalid district map join");
  if (data.areas.filter(a => a.level === "collection").length !== 1) throw new Error("Missing collection votes");
  if (expected) {
    const sum = sumObservations(data.areas.map(a => a.results.find(r => r.year === 2022)!), 2022);
    if (sum.validVotes !== expected.validVotes || sum.totalVotes !== expected.totalVotes || sum.eligibleVoters !== expected.eligibleVoters || PARTY_IDS.some(p => sum.votes[p] !== expected.votes[p])) throw new Error("Districts do not reconcile to the municipality");
  }
}
