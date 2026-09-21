import { PARTY_IDS } from "../data/elections/types";
import { PARTY_CODE_TO_ID } from "./constants";
import { percent, insist, integer, object, list } from "./validation";
import type { AreaResult, CountedArea } from "./area-types";
import { PARTIES } from "../parties";

/** Compact party buckets in PARTY_IDS order; collection votes have no polygon. */
export type MapDistrict = {
  code: string; name: string; municipality: string; constituency: string;
  collection: boolean; reported: boolean; eligibleVoters: number | null;
  validVotes: number; invalidVotes: number; votes: number[];
  previous: { validVotes: number; totalVotes: number; eligibleVoters: number; votes: (number | null)[] } | null;
};
export function areaVoteBuckets(area: CountedArea): number[] {
  return PARTY_IDS.map(id => id === "OTHER" ? area.otherVotes + area.parties.filter(p => !PARTY_CODE_TO_ID[p.code]).reduce((s,p) => s+p.votes,0) : area.parties.filter(p => PARTY_CODE_TO_ID[p.code] === id).reduce((s,p) => s+p.votes,0));
}
export function previousVoteBuckets(area: CountedArea): (number | null)[] | null {
  const old = area.previous; if (!old) return null;
  const major = PARTY_IDS.filter(id => id !== "OTHER").map(id => old.parties.find(p => PARTY_CODE_TO_ID[p.code] === id)?.votes ?? null);
  return PARTY_IDS.map(id => id === "OTHER" ? (major.every(v => v !== null) ? old.validVotes - major.reduce((s,v) => s+v,0) : null) : old.parties.find(p => PARTY_CODE_TO_ID[p.code] === id)?.votes ?? null);
}
export function validateMapDistricts(result: AreaResult): void {
  if (result.districts === undefined) { insist(result.districtSource == null, "Missing district rows"); return; }
  const rows = list(result.districts, "map districts") as MapDistrict[];
  insist(result.districtSource?.archiveMd5 === result.source.archiveMd5, "District generation mismatch");
  insist(rows.length === result.area.totalDistricts && new Set(rows.map(d => d.code)).size === rows.length, "District coverage mismatch");
  for (const value of rows) {
    const d = object(value, "map district");
    insist(typeof d.name === "string" && /^\d{6,8}$/.test(String(d.code)) && /^\d{4}$/.test(String(d.municipality)) && String(d.code).startsWith(String(d.municipality)), "Invalid district identity");
    insist(typeof d.reported === "boolean" && typeof d.collection === "boolean", "Invalid district state");
    const valid = integer(d.validVotes,"district valid"), invalid = integer(d.invalidVotes,"district invalid");
    insist(d.reported || valid+invalid === 0, "Unreported district has votes");
    insist(d.collection ? d.eligibleVoters === null : valid+invalid <= integer(d.eligibleVoters,"district electorate"), "Invalid district electorate");
    const votes = list(d.votes,"district votes").map(v => integer(v,"district party votes"));
    insist(votes.length === PARTY_IDS.length && votes.reduce((s,v) => s+v,0) === valid, "District party totals disagree");
    if (d.previous !== null) {
      const p = object(d.previous,"district comparison"), pv = integer(p.validVotes,"previous valid"), pt = integer(p.totalVotes,"previous total"), pe = integer(p.eligibleVoters,"previous electorate");
      insist(!d.collection && pv <= pt && pt <= pe, "Invalid district comparison totals");
      const values = list(p.votes,"previous district votes");
      insist(values.length === PARTY_IDS.length && values.every(v => v === null || integer(v,"previous party") <= pv), "Invalid previous district party");
      if (values.every(v => v !== null)) insist((values as number[]).reduce((s,v) => s+v,0) === pv,"Previous district buckets disagree");
    }
  }
  const validateTotal = (districts: MapDistrict[], area: CountedArea) => {
    insist(districts.length === area.totalDistricts && districts.filter(d => d.reported).length === area.countedDistricts,"District counting totals disagree");
    for (const field of ["validVotes","invalidVotes"] as const) insist(districts.reduce((s,d) => s+d[field],0) === area[field], `District totals disagree: ${field}`);
    insist(districts.reduce((s,d) => s+(d.eligibleVoters ?? 0),0) === area.eligibleVoters && districts.filter(d => d.reported).reduce((s,d) => s+(d.eligibleVoters ?? 0),0) === area.eligibleInCountedDistricts,"District electorate totals disagree");
    areaVoteBuckets(area).forEach((n,i) => insist(districts.reduce((s,d) => s+d.votes[i],0) === n,"District party aggregate disagrees"));
  };
  validateTotal(rows,result.area);
  const byMunicipality = new Map<string,MapDistrict[]>();
  for (const d of rows) { const group = byMunicipality.get(d.municipality) ?? []; group.push(d); byMunicipality.set(d.municipality,group); }
  if (result.electionType === "KF") insist([...byMunicipality.keys()].every(c => c === result.area.code),"Wrong district municipality");
  else { insist(byMunicipality.size === result.municipalities.length,"Incomplete district municipalities"); for (const area of result.municipalities) validateTotal(byMunicipality.get(area.code) ?? [],area); }
}
export const districtTurnout = (d: MapDistrict) => !d.reported || d.eligibleVoters === null ? null : percent(d.validVotes+d.invalidVotes,d.eligibleVoters);

export function districtAsArea(d: MapDistrict): CountedArea {
  const codes = Object.fromEntries(Object.entries(PARTY_CODE_TO_ID).map(([code,id])=>[id,code]));
  const parties = PARTY_IDS.filter(id=>id!=="OTHER").map(id=>{const votes=d.votes[PARTY_IDS.indexOf(id)];return {code:codes[id],name:PARTIES[id].name,abbreviation:id,votes,share:percent(votes,d.validVotes),seats:null,fixedSeats:null,adjustmentSeats:null};});
  return {code:d.code,name:d.name,countedDistricts:Number(d.reported),totalDistricts:1,validVotes:d.validVotes,invalidVotes:d.invalidVotes,totalVotes:d.validVotes+d.invalidVotes,eligibleVoters:d.eligibleVoters??0,eligibleInCountedDistricts:d.reported?(d.eligibleVoters??0):0,turnoutInCountedDistricts:districtTurnout(d),parties,otherVotes:d.votes[PARTY_IDS.indexOf("OTHER")],previous:d.previous?{year:2022,...d.previous,turnout:percent(d.previous.totalVotes,d.previous.eligibleVoters),otherVotes:d.previous.votes[PARTY_IDS.indexOf("OTHER")],parties:parties.map(p=>{const votes=d.previous!.votes[PARTY_IDS.indexOf(PARTY_CODE_TO_ID[p.code])];return {code:p.code,votes,share:votes===null?null:percent(votes,d.previous!.validVotes),seats:null};})}:null};
}
