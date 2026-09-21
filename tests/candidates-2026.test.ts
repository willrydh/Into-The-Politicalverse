import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { getCandidateData } from "../lib/candidates/build";
import { verifyCandidates2026 } from "../lib/candidates/verify-2026";
import { parseCandidateCsv, personalCandidates } from "../lib/candidates/import-2026";
import { linkIdentities, extendIdentityGroups, type IdentityInput } from "../lib/candidates/identity";
import { selectCandidateProfile } from "../lib/candidates/profile-selection";
import { compareCandidate } from "../lib/candidates/math";
import { buildSharePerson } from "../lib/candidates/build-sharing";
import { buildStandings } from "../lib/candidates/build-standings";
import { validateRankings, validateCatalog } from "../lib/candidates/validation";
import type { CandidateSource, CandidateYear } from "../lib/candidates/types";

const data = getCandidateData();
const source = JSON.parse(gunzipSync(readFileSync("data/normalized/candidate-elections-2026.json.gz")).toString()) as CandidateSource;
const raw = JSON.parse(gunzipSync(readFileSync("data/raw/valmyndigheten-2026/candidates/RD-00.json.gz")).toString());

test("2026 personal votes reproduce signed established sources and every Riksdag party denominator", () => {
  const verified = verifyCandidates2026();
  assert.equal(verified.areas, source.areas.length);
  assert.equal(source.areas.filter(a => a.electionType === "RD").length, 29);
  const rows = data.rankings.get("2026-RD")!.rows;
  assert.equal(rows.reduce((s, r) => s + r.votes, 0), source.anchors.RD.personalVotes);
  for (const area of source.areas.filter(a => a.electionType === "RD")) {
    const official = raw.valomrade.valkretsLista.find((c: {kod: string}) => c.kod === area.code);
    for (const p of official.rostfordelning.rosterPaverkaMandat.partiRoster) assert.equal(area.partyVotes[p.partikod], p.antalRoster);
  }
  for (const ranking of data.rankings.values()) validateRankings(ranking);
  validateCatalog(data.catalog);
});

test("all 207104 old source identities retain their exact public profile URL", () => {
  const identities: IdentityInput[] = [];
  for (const year of [2010, 2014, 2018, 2022] as CandidateYear[]) {
    const old = JSON.parse(gunzipSync(readFileSync(`data/normalized/candidate-elections-${year}.json.gz`)).toString()) as CandidateSource;
    for (const [id, identity] of Object.entries(old.identities)) identities.push({...identity, year, key:`${year}:${id}`});
  }
  const groups = linkIdentities(identities);
  assert.equal(groups.length,142108);
  for (const group of groups) for (const identity of group) assert.equal(data.sourcePeople.get(identity.key)!.id,`p${group[0].key.replace(":","-")}`);
});

test("new evidence never merges older profiles and competing new identities remain separate", () => {
  const old: IdentityInput = {key:"2022:1",year:2022,names:["Test Person"],ages:[40],municipalities:["1480"]};
  const next: IdentityInput = {...old,key:"2026:2",year:2026,ages:[44]};
  assert.deepEqual(extendIdentityGroups([[old]], [next]), [[old,next]]);
  assert.equal(extendIdentityGroups([[old],[{...old,key:"2022:3"}]], [next]).length,3);
  assert.equal(extendIdentityGroups([[old]], [next,{...next,key:"2026:4"}]).length,3);
  assert.equal(extendIdentityGroups([[old]], [{...next,ages:[]}]).length,2);
});

test("latest default profile and sharing scope include 2026 while an explicit older election remains selectable", () => {
  const lars=data.sourcePeople.get("2026:31664")!;
  assert.equal(lars.id,"p2014-430402");
  const selected=selectCandidateProfile(lars,new URLSearchParams());
  assert.equal(selected.latest.year,2026);
  assert.equal(selected.election,lars.results.some(r=>r.year===2026&&r.electionType==="KF") ? "KF" : "RD");
  const row=lars.results.find(r=>r.year===2026&&r.electionType==="RD"&&r.areaCode==="19")!;
  const official=raw.valomrade.valkretsLista.find((a:{kod:string})=>a.kod==="19").rostfordelning.rosterPaverkaMandat.partiRoster.find((p:{partikod:string})=>p.partikod==="0001").summeradePersonroster.find((c:{kandidatnummer:number})=>c.kandidatnummer===31664);
  assert.equal(row.votes,official.antalPersonroster);
  const comparison=compareCandidate(row,lars.results);
  assert.equal(comparison.previous?.votes,102); assert.equal(comparison.delta,row.votes-102);
  assert.equal(comparison.percent,(row.votes-102)/102*100);
  const share=buildSharePerson(lars);
  assert.equal(share.defaultElection,selected.election);
  assert.equal(selectCandidateProfile(lars,new URLSearchParams("election=KF")).election,"KF");
});

test("partial 2026 cohorts earn local placements but cannot claim national or incomplete-county ranks", () => {
  const base=data.rankings.get("2026-RD")!;
  const row=base.rows.find(r=>r.votes>100)!;
  const payload={...base,rows:[row],coverage:{expected:29,published:1,final:[row.areaCode],completeCounties:[]}};
  const standings=buildStandings([data.sourcePeople.get(`2026:${row.id}`)!],[payload]);
  const records=standings.get(row.person)!;
  assert(records.length>0); assert(records.every(r=>r.ranks.every(s=>s[1]==="area")));
  const complete={...payload,coverage:{...payload.coverage,expected:1,completeCounties:[row.county]}};
  assert(buildStandings([data.sourcePeople.get(`2026:${row.id}`)!],[complete]).get(row.person)!.some(r=>r.ranks.some(s=>s[1]==="national")));
});

test("candidate CSV handles source quotes, semicolons and multiline fields without shifting columns", () => {
  assert.deepEqual(parseCandidateCsv('a;b\r\n"one;two";"three\nlines"\r\nA "nickname" B;"he said ""yes"""'),[["a","b"],["one;two","three\nlines"],['A "nickname" B','he said "yes"']]);
  assert.throws(()=>parseCandidateCsv('a;"unterminated'));
  assert.throws(()=>parseCandidateCsv('a;"quoted"unexpected'));
});

test("ballot and summed candidate representations must agree and are never double-counted", () => {
  const area=raw.valomrade.valkretsLista.find((a: {kod:string})=>a.kod==="19");
  const original=personalCandidates(area);
  assert(original.candidates.some(c=>c.id==="31664"&&c.partyCode==="0001"));
  const bad=structuredClone(area);
  const p=bad.rostfordelning.rosterPaverkaMandat.partiRoster.find((p:{summeradePersonroster?:unknown[]})=>p.summeradePersonroster?.length);
  p.summeradePersonroster[0].antalPersonroster++;
  assert.throws(()=>personalCandidates(bad),/disagree/);
  const duplicate=structuredClone(area);
  const first=duplicate.rostfordelning.rosterPaverkaMandat.partiRoster.find((p:{listRoster:unknown[]})=>p.listRoster.length);
  first.listRoster.push(first.listRoster[0]);
  assert.throws(()=>personalCandidates(duplicate),/duplicate ballot/);
});
