// Build-time only: source files and identity metadata never enter a UI bundle.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { CANDIDATE_YEARS, CANDIDATE_METHOD, type CandidateSource, type CandidateCatalog, type Person, type RankingRow, type CandidateResult, type RankingsPayload } from "./types";
import { linkIdentities, type IdentityInput } from "./identity";
import { compareCandidate } from "./math";
import type { LocalElectionIndex } from "../data/geography/local-types";
import { candidatePartyId } from "./source-parties";
import { validateBallotPositions } from "./ballots";
const read = (p: string) => readFileSync(join(process.cwd(), p));
let cached: ReturnType<typeof buildCandidateData> | undefined;
export const getCandidateData = () => cached ??= buildCandidateData();
export function buildCandidateData() {
  const manifest = JSON.parse(read("data/raw/valmyndigheten/candidate-history-source-manifest.json").toString());
  const identityInputs: IdentityInput[] = [], observations = new Map<string, CandidateResult[]>();
  for (const year of CANDIDATE_YEARS) {
    const filename = `data/normalized/candidate-elections-${year}.json.gz`, raw = read(filename);
    if (createHash("sha256").update(raw).digest("hex") !== manifest.outputs[filename]) throw new Error(`Candidate source checksum ${year}`);
    const data = JSON.parse(gunzipSync(raw).toString()) as CandidateSource;
    if (data.schemaVersion !== 1 || data.year !== year || data.classification !== "OFFICIAL" || data.status !== "final" || data.methodVersion !== CANDIDATE_METHOD) throw new Error("Candidate source schema");
    for (const [id, identity] of Object.entries(data.identities)) identityInputs.push({ ...identity, key: `${year}:${id}`, year });
    const totals: Record<string, number> = {}, areaKeys = new Set<string>();
    for (const area of data.areas) {
      const areaKey = `${area.electionType}:${area.code}:${area.level}`;
      if (areaKeys.has(areaKey)) throw new Error(`Duplicate candidate area ${areaKey}`);
      areaKeys.add(areaKey);
      const seen = new Set<string>(), partyTotals: Record<string, number> = {};
      for (const c of area.candidates) {
        validateBallotPositions(c.ballotPositions, c.partyCode);
        if (c.ballotPositions.length > c.lists) throw new Error("Ballot positions exceed source list rows");
        if (c.partyId !== candidatePartyId(c.partyCode)) throw new Error(`Candidate party identity ${year}:${c.partyCode}`);
        if (seen.has(`${c.partyCode}:${c.id}`)) throw new Error("Duplicate candidate in an area");
        seen.add(`${c.partyCode}:${c.id}`);
        if (![c.votes, c.partyVotes].every(n => Number.isSafeInteger(n) && n >= 0) || c.votes > c.partyVotes || c.partyVotes !== area.partyVotes[c.partyCode] || !data.identities[c.id]) throw new Error(`Invalid candidate count ${year}:${c.id}`);
        partyTotals[c.partyCode] = (partyTotals[c.partyCode] ?? 0) + c.votes;
        if (area.level === "constituency") totals[area.electionType] = (totals[area.electionType] ?? 0) + c.votes;
        const key = `${year}:${c.id}`, rows = observations.get(key) ?? [];
        // Aggregate municipalities/regions have stable administrative units.
        // Riksdag membership is checked against the actual municipality list.
        // Sub-regional constituencies are shown but never presumed comparable.
        const boundaryKey = area.level !== "constituency" ? `${area.electionType}:${area.code}` : area.electionType === "RD" && area.members?.length ? area.members.join(",") : null;
        rows.push({ ...c, year, electionType: area.electionType, areaCode: area.code, areaName: area.name, level: area.level, county: area.county, supersededBy: area.supersededBy, boundaryKey });
        observations.set(key, rows);
      }
      if (Object.entries(partyTotals).some(([p, votes]) => votes > area.partyVotes[p])) throw new Error("Personal votes exceed party votes");
    }
    for (const [election, anchor] of Object.entries(data.anchors)) if (totals[election] !== anchor.personalVotes) throw new Error(`National personal-vote reconciliation ${year}:${election}`);
    if (data.areas.filter(a => a.electionType === "RD").length !== 29 || data.areas.filter(a => a.level === "municipality").length !== 290 || data.areas.filter(a => a.level === "region").length !== 20) throw new Error(`Candidate coverage ${year}`);
  }
  const groups = linkIdentities(identityInputs), people: Person[] = [], sourcePeople = new Map<string, Person>();
  for (const group of groups) {
    const results = group.flatMap(i => observations.get(i.key) ?? []);
    const names = [...new Set(group.flatMap(i => i.names))];
    if (!names.length || !results.length) throw new Error("Missing candidate identity");
    results.sort((a, b) => b.year - a.year || a.electionType.localeCompare(b.electionType) || a.areaCode.localeCompare(b.areaCode) || a.partyCode.localeCompare(b.partyCode));
    const person: Person = { id: `p${group[0].key.replace(":", "-")}`, name: results[0].name, aliases: names, sourceIds: group.map(i => i.key), linked: group.length > 1, results };
    people.push(person); for (const identity of group) sourcePeople.set(identity.key, person);
  }
  people.sort((a, b) => a.id.localeCompare(b.id));
  const version = createHash("sha256").update(JSON.stringify({ outputs: manifest.outputs, method: CANDIDATE_METHOD })).digest("hex");
  const geography = JSON.parse(read("data/normalized/local-election-index.json").toString()) as LocalElectionIndex;
  const rdAreas = JSON.parse(read("data/normalized/personal-votes-2022.json").toString()).constituencies as {code:string;name:string}[];
  const catalog: CandidateCatalog = { schemaVersion: 1, version, methodVersion: CANDIDATE_METHOD, publisher: "Valmyndigheten", retrievedAt: manifest.retrievedAt, years: [...CANDIDATE_YEARS], people: people.length, linkedPeople: people.filter(p => p.linked).length, electionIdentities: identityInputs.length, results: people.reduce((sum,p)=>sum+p.results.length,0), counties: geography.counties.map(c=>({code:c.code,name:c.name})), municipalities: geography.municipalities.map(m=>({code:m.code,name:m.name,parent:m.parent!})), constituencies: rdAreas.map(c=>({code:c.code,name:c.name,county:geography.municipalities.find(m=>m.constituencies?.includes(c.code))!.parent!})), sources: manifest.sources };
  const rankings = new Map<string, RankingsPayload>();
  for (const year of CANDIDATE_YEARS) for (const electionType of ["RD", "RF", "KF"] as const) rankings.set(`${year}-${electionType}`, { schemaVersion: 1, version, year, electionType, rows: [] });
  for (const person of people) for (const result of person.results) {
    if (result.electionType !== "RD" && result.level === "constituency") continue;
    const row: RankingRow = { ...result, person: person.id, linked: person.linked, comparison: compareCandidate(result, person.results) };
    rankings.get(`${result.year}-${result.electionType}`)!.rows.push(row);
  }
  return { catalog, people, sourcePeople, rankings };
}

import type { CandidateSearchIndex } from "./search";
import { PARTIES } from "../parties";
import { translateText } from "../i18n/translate";
export function buildCandidateSearch() {
const {catalog,people}=getCandidateData();
const search: CandidateSearchIndex = { schemaVersion:1, version:catalog.version, parties:{}, areas:{}, rows:[] };
for (const person of people) {
  const parties=new Set<string>(), areas=new Set<string>();
  for (const r of person.results) {
    const p=r.partyCode;
    search.parties[p]=[r.partyId==="OTHER"?r.partyName:PARTIES[r.partyId].name,r.partyId==="OTHER"?r.partyName:translateText(PARTIES[r.partyId].name,"en"),r.partyId==="L"?"L FP Folkpartiet Liberalerna Liberals":r.partyId==="OTHER"?r.partyName:r.partyId];
    parties.add(p);
    if (r.electionType!=="RD"&&r.level==="constituency") continue;
    const key=`${r.electionType}:${r.areaCode}`; areas.add(key);search.areas[key]=[r.areaName,r.electionType,r.areaCode];
  }
  search.rows.push([person.id,person.name,person.aliases.filter(n=>n!==person.name),[...new Set(person.results.map(r=>r.year))].sort(),[...parties],[...areas]]);
}
return search;
}
