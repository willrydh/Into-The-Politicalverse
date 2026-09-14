import type { CountedArea } from "./area-types";
import { percent, insist } from "./validation";

/** Administrative RD total from one signed municipal summary, with no local seats. */
export function aggregateMunicipalVotes(areas: CountedArea[], code: string, name: string): CountedArea {
  insist(areas.length > 0 && new Set(areas.map(a => a.code)).size === areas.length, "Empty or duplicated municipal aggregate");
  const sum = (key: "validVotes" | "invalidVotes" | "totalVotes" | "eligibleVoters" | "eligibleInCountedDistricts" | "countedDistricts" | "totalDistricts" | "otherVotes") => areas.reduce((s, a) => s + a[key], 0);
  const validVotes = sum("validVotes"), totalVotes = sum("totalVotes"), eligibleInCountedDistricts = sum("eligibleInCountedDistricts");
  const definitions = [...new Map(areas.flatMap(a => a.parties).map(p => [p.code, p])).values()];
  const parties = definitions.map(p => { const votes = areas.reduce((s, a) => s + (a.parties.find(x => x.code === p.code)?.votes ?? 0), 0); return { ...p, votes, share: percent(votes, validVotes), seats: null, fixedSeats: null, adjustmentSeats: null }; });
  const old = areas.map(a => a.previous);
  let previous: CountedArea["previous"] = null;
  if (old.every(p => p != null)) {
    const previousValid = old.reduce((s, p) => s + p.validVotes, 0), previousTotal = old.reduce((s, p) => s + p.totalVotes, 0), previousEligible = old.reduce((s, p) => s + p.eligibleVoters, 0);
    previous = { year: 2022, validVotes: previousValid, totalVotes: previousTotal, eligibleVoters: previousEligible, turnout: percent(previousTotal, previousEligible), otherVotes: old.every(p => p.otherVotes !== null) ? old.reduce((s, p) => s + p.otherVotes!, 0) : null, parties: parties.map(p => { const votes = old.map(o => o.parties.find(x => x.code === p.code)?.votes); const total = votes.every(v => v != null) ? votes.reduce((s, v) => s + v, 0) : null; return { code: p.code, votes: total, share: total === null ? null : percent(total, previousValid), seats: null }; }) };
  }
  return { code, name, countedDistricts: sum("countedDistricts"), totalDistricts: sum("totalDistricts"), validVotes, invalidVotes: sum("invalidVotes"), totalVotes, eligibleVoters: sum("eligibleVoters"), eligibleInCountedDistricts, turnoutInCountedDistricts: percent(totalVotes, eligibleInCountedDistricts), parties, otherVotes: sum("otherVotes"), previous };
}
