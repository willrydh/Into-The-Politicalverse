import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { getCandidateData } from "../lib/candidates/build";
import { verifyCandidates2026 } from "../lib/candidates/verify-2026";
import { parseCandidateCsv, personalCandidates, personalCountComplete } from "../lib/candidates/import-2026";
import { candidateCoverageSelection } from "../lib/candidates/coverage";
import { normalizeAreaResult } from "../lib/live/area-adapter";
import { areaIsEstablished } from "../lib/live/area-types";
import { linkIdentities, extendIdentityGroups, type IdentityInput } from "../lib/candidates/identity";
import { selectCandidateProfile } from "../lib/candidates/profile-selection";
import { compareCandidate } from "../lib/candidates/math";
import { buildSharePerson } from "../lib/candidates/build-sharing";
import { selectShareScope } from "../lib/candidates/sharing";
import { buildStandings } from "../lib/candidates/build-standings";
import { validateRankings, validateCatalog } from "../lib/candidates/validation";
import { readSignedArchive, digest } from "../lib/live/official-files";
import type { CandidateSource, CandidateYear } from "../lib/candidates/types";

const data = getCandidateData();
const source = JSON.parse(gunzipSync(readFileSync("data/normalized/candidate-elections-2026.json.gz")).toString()) as CandidateSource;
const raw = JSON.parse(gunzipSync(readFileSync("data/raw/valmyndigheten-2026/candidates/RD-00.json.gz")).toString());

test("2026 personal votes reproduce signed counts, establishment status and every Riksdag party denominator", () => {
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

test("Mark's complete signed personal count is usable before mandates and protocol exist", async () => {
  const archive = readFileSync("tests/fixtures/valmyndigheten-2026/areas/KF-1463-counted.zip");
  const signed = await readSignedArchive(archive, { url: "https://resultat.val.se/resultatfiler/val2026/s/kf/Val_2026_slutlig_1463_KF.zip", md5: "2827f1aa51b9c5b9e88f50bdf46bb603" }, { mode: "production", stage: "final-count", area: { electionType: "KF", code: "1463" }, now: "2026-09-24T07:00:00Z", certificate: readFileSync("data/raw/valmyndigheten-2026/val-sign-crt.pem") });
  const area = (signed.raw as typeof raw).valomrade;
  assert.equal(area.antalValdistriktRaknade, 23);
  assert.equal(area.antalValdistriktSomSkaRaknas, 23);
  assert.equal(personalCountComplete(area), true);
  assert.equal(area.lankTillProtokoll ?? null, null);
  assert.equal(area.mandatfordelning ?? null, null);
  assert.equal(areaIsEstablished(normalizeAreaResult(signed.raw, { electionType: "KF", code: "1463", stage: "final-count", now: "2026-09-24T07:00:00Z", source: signed.source })), false);
  const candidates = personalCandidates(area).candidates;
  assert.equal(candidates.length, 193);
  assert.equal(candidates.find(c => c.id === "31647")?.votes, 338);
  assert.equal(candidates.find(c => c.id === "31647")?.partyVotes, 4277);
  assert.equal(personalCountComplete({...area, antalValdistriktRaknade:22}), false);
  assert.equal(personalCountComplete({antalValdistriktRaknade:0, antalValdistriktSomSkaRaknas:0}), false);
});

test("coverage separates available counts from establishment and legacy final coverage still works", () => {
  const catalog = structuredClone(data.catalog);
  catalog.coverage2026!.KF = {expected:290,published:2,counted:["1463","0428"],final:["0428"]};
  assert.deepEqual(candidateCoverageSelection(catalog,"KF","14","1463"), {expected:1,counted:1,final:0,complete:true,established:false,county:"14"});
  assert.equal(candidateCoverageSelection(catalog,"KF","04","0428").established,true);
  assert.equal(candidateCoverageSelection(catalog,"KF","14","1490").counted,0);
  assert.equal(candidateCoverageSelection(catalog,"KF").complete,false);
  assert.equal(candidateCoverageSelection(catalog,"RF").expected,20);
  delete catalog.coverage2026!.KF.counted;
  assert.equal(candidateCoverageSelection(catalog,"KF","04","0428").complete,true);
});

test("counted local results reach rankings, profiles and sharing without claiming final or national standing", () => {
  const base = data.rankings.get("2026-KF")!;
  const row = base.rows.find(r => r.areaCode === "1463" && r.id === "31647")!;
  assert(row);
  const official = JSON.parse(gunzipSync(readFileSync("data/raw/valmyndigheten-2026/candidates/KF-1463.json.gz")).toString());
  const ekberg = personalCandidates(official.valomrade).candidates.find(c => c.id === "31647")!;
  assert.equal(row.votes,ekberg.votes);
  const person = data.sourcePeople.get("2026:31647")!;
  const selection = selectCandidateProfile(person,new URLSearchParams("election=KF&area=1463"));
  assert.equal(selection.latest.year,2026); assert.equal(selection.latest.votes,row.votes);
  const share = selectShareScope(buildSharePerson(person),new URLSearchParams("election=KF&area=1463"));
  assert.equal(share.status,row.status); assert.equal(share.votes,row.votes);
  const counted = {...base,rows:[{...row,status:"counted" as const}],coverage:{expected:290,published:1,counted:["1463"],final:[],completeCounties:[]}};
  validateRankings(counted);
  assert.throws(() => validateRankings({...counted,rows:[{...row,status:"final"}]}));
  const ranks = buildStandings([person],[counted]).get(person.id)!;
  assert(ranks.length > 0); assert(ranks.every(r => r.ranks.every(s => s[1] === "area")));
  const established = {...counted,rows:[{...row,status:"final" as const}],coverage:{...counted.coverage,final:["1463"]}};
  validateRankings(established);
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

test("a candidate who changes area lands on the latest area while explicit historical links are preserved", () => {
  const moved = structuredClone(data.sourcePeople.get("2026:31664")!);
  moved.results = moved.results.filter(r => r.electionType === "RD");
  for (const r of moved.results) if (r.year === 2026) { r.areaCode = "01"; r.areaName = "Stockholms kommun"; }
  const current = selectCandidateProfile(moved, new URLSearchParams());
  assert.equal(current.area, "01"); assert.equal(current.latest.year, 2026);
  assert.equal(selectShareScope(buildSharePerson(moved), new URLSearchParams()).area, "01");
  const previous = selectCandidateProfile(moved, new URLSearchParams("area=19"));
  assert.equal(previous.area, "19"); assert.equal(previous.latest.year, 2022);
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

test("multi-constituency municipal personal votes reconcile to the signed council total with distinct list positions", async () => {
  const archive = readFileSync("tests/fixtures/valmyndigheten-2026/areas/KF-2284-final.zip");
  const signed = await readSignedArchive(archive, { url: "https://resultat.val.se/resultatfiler/val2026/s/kf/Val_2026_slutlig_2284_KF.zip", md5: digest(archive, "md5") }, { mode: "production", stage: "final-count", area: { electionType: "KF", code: "2284" }, now: "2026-09-23T19:00:00Z", certificate: readFileSync("data/raw/valmyndigheten-2026/val-sign-crt.pem") });
  const area = (signed.raw as typeof raw).valomrade;
  const result = personalCandidates(area);
  const nordin = result.candidates.find(c => c.id === "51124" && c.partyCode === "0001")!;
  assert.equal(nordin.votes, 788); assert.equal(nordin.partyVotes, 6355);
  assert.equal(nordin.lists, new Set(nordin.ballotPositions.map(p => p.listNumber)).size);
  assert.equal(new Set(nordin.ballotPositions.map(p => `${p.listNumber}/${p.position}`)).size, nordin.ballotPositions.length);
  for (const p of area.rostfordelning.rosterPaverkaMandat.partiRoster) {
    assert.equal(result.partyVotes[p.partikod], p.antalRoster);
    for (const c of p.summeradePersonroster ?? []) assert.equal(result.candidates.find(row => row.partyCode === p.partikod && row.id === String(c.kandidatnummer))?.votes, c.antalPersonroster);
  }
  const duplicate = structuredClone(area); duplicate.valkretsLista.push(duplicate.valkretsLista[0]);
  assert.throws(() => personalCandidates(duplicate), /duplicate council constituency/);
  const changed = structuredClone(area); changed.rostfordelning.rosterPaverkaMandat.partiRoster[0].summeradePersonroster[0].antalPersonroster++;
  assert.throws(() => personalCandidates(changed), /personal votes disagree/);
  const denominator = structuredClone(area); denominator.rostfordelning.rosterPaverkaMandat.partiRoster[0].antalRoster++;
  assert.throws(() => personalCandidates(denominator), /party votes disagree/);
  const missing = structuredClone(area); delete missing.valkretsLista;
  assert.throws(() => personalCandidates(missing), /final ballot lists/);
});
