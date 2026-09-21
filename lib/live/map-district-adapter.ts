import preparation from "../../data/normalized/election-preparation-2026.json";
import { PARTY_IDS } from "../data/elections/types";
import { assertAreaIdentity } from "./area-adapter";
import { normalizeComparison } from "./comparison";
import { PARTY_CODE_TO_ID } from "./constants";
import { previousVoteBuckets, validateMapDistricts, type MapDistrict } from "./map-districts";
import { checkRoundedPercent, insist, integer, list, object, percent, sourceTimestamp, string } from "./validation";
import type { AreaResult, CountedArea } from "./area-types";
import type { LiveResult } from "./types";

const geography = new Map(preparation.districts.map(d => [d.code,d]));
export function attachMapDistricts(result: AreaResult, raw: unknown, source: LiveResult["source"], now: string): void {
  const { d, sourceRevision, sourceUpdatedAt } = assertAreaIdentity(raw,result.electionType,result.stage,now);
  // File generation times within one archive differ (RD revision 860: district
  // 14:51:58, mandates 14:53:03, summary 14:53:14). Revision and signed ZIP match.
  insist(sourceRevision === result.sourceRevision && source.archiveMd5 === result.source.archiveMd5,"District source generation mismatch");
  result.districts = list(d.valdistrikt,"districts").map((value): MapDistrict => {
    const a = object(value,"district"), code = string(a.valdistriktskod,"district code"), municipality = string(a.kommunkod,"municipality"), constituency = string(a.kretskod,"constituency");
    const kind = string(a.valdistriktstyp,"district type"); insist(["valdistrikt","uppsamlingsdistrikt"].includes(kind),"Unknown district type");
    const collection = kind === "uppsamlingsdistrikt", g = geography.get(code);
    insist(collection ? /^\d{6}$/.test(code) && preparation.municipalities.some(m => m.code === municipality) : Boolean(g && g.municipality === municipality && (result.electionType !== "RD" || g.constituency === constituency)),"District geography not verified");
    const reported = a.rapporteringsTid != null && a.rapporteringsTid !== "";
    if (reported) insist(sourceTimestamp(a.rapporteringsTid) <= sourceUpdatedAt,"Future district report");
    const eligibleVoters = collection ? null : integer(a.antalRostberattigade,"district electorate");
    insist(!collection || a.antalRostberattigade === null,"Collection district adds electorate");
    const votes = PARTY_IDS.map(() => 0); let validVotes = 0, invalidVotes = 0;
    if (a.rostfordelning === null) insist(!reported && a.totaltAntalRoster === 0,"Missing reported votes");
    else {
      const dist = object(a.rostfordelning,"district distribution"), valid = object(dist.rosterPaverkaMandat,"valid votes");
      validVotes = integer(valid.antalRoster,"valid votes"); invalidVotes = integer(object(dist.rosterEjPaverkaMandat,"invalid votes").antalRoster,"invalid votes");
      const seen = new Set<string>();
      for (const value of list(valid.partiRoster,"district parties")) {
        const p = object(value,"party"), code = string(p.partikod,"party code"), n = integer(p.antalRoster,"party votes");
        insist(/^\d{4}$/.test(code) && !seen.has(code),"Invalid/duplicate district party"); seen.add(code);
        checkRoundedPercent(p.andelRoster,percent(n,validVotes),"district party share");
        votes[PARTY_IDS.indexOf(PARTY_CODE_TO_ID[code] ?? "OTHER")] += n;
      }
      if (valid.rosterOvrigaPartier != null) votes[PARTY_IDS.indexOf("OTHER")] += integer(object(valid.rosterOvrigaPartier,"other votes").antalRoster,"other votes");
    }
    insist(validVotes+invalidVotes === a.totaltAntalRoster,"District all votes disagree");
    if (!collection && reported) checkRoundedPercent(a.valdeltagandeVallokal,percent(validVotes+invalidVotes,eligibleVoters!),"district turnout");
    // The result archive is the authority for comparable 2022 counts. Never
    // attach old counts by reusing an unchanged-looking district code.
    let comparison = null;
    if (!collection) {
      try { comparison = normalizeComparison(a,d.tidigareValdatum); }
      catch (e) { if (!(e instanceof Error) || e.message !== "Previous parties do not reconcile") throw e; }
    }
    const previous = comparison ? { validVotes: comparison.validVotes, totalVotes: comparison.totalVotes, eligibleVoters: comparison.eligibleVoters, votes: previousVoteBuckets({previous:comparison} as CountedArea)! } : null;
    return { code, name: typeof a.namn === "string" && a.namn.trim() ? a.namn : g?.name ?? code, municipality, constituency, collection, reported, eligibleVoters, validVotes, invalidVotes, votes, previous };
  });
  result.districtSource = source;
  validateMapDistricts(result);
}
