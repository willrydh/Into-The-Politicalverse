import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { getCandidateData, buildCandidateSearch } from "../lib/candidates/build";
import { linkIdentities, type IdentityInput } from "../lib/candidates/identity";
import { compareCandidate, rankCandidates, voteChange, personalVoteShare } from "../lib/candidates/math";
import { validateCatalog, validatePersonShard, validateRankings } from "../lib/candidates/validation";
import { candidateSearchEntries } from "../lib/candidates/search";
import { type RankingRow, personShard } from "../lib/candidates/types";
import { localVoteChange, localSwing } from "../lib/data/geography/local-math";
import { readLocalSelection } from "../lib/data/geography/local-selection";
import type { LocalElectionIndex } from "../lib/data/geography/local-types";
import type { PersonalVoteData } from "../lib/data/geography/personal-votes";

const data=getCandidateData();
const lars=data.sourcePeople.get("2022:46783")!;
test("all eight parties keep official source codes and identity across elections, including MP and KD",()=>{
  const expected:Record<string,string>={"0001":"M","0002":"S","0003":"L","0004":"C","0005":"V","0055":"MP","0068":"KD","0110":"SD"};
  for(const ranking of data.rankings.values()) {
    for(const row of ranking.rows) assert.equal(row.partyId,expected[row.partyCode]??"OTHER");
    assert.equal(new Set(ranking.rows.filter(r=>r.partyId!=="OTHER").map(r=>r.partyId)).size,8);
    for(const id of ["MP","KD"]) if(ranking.year===2022) {
      const continuing=ranking.rows.filter(r=>r.partyId===id&&r.comparison.previous?.partyId===id);
      assert.ok(continuing.length>0);
      for(const row of continuing) assert.equal(row.partyCode,row.comparison.previous!.partyCode,"Same-party candidates must not appear to switch parties");
    }
  }
  const ranking=data.rankings.get("2022-RD")!;
  const sample={...ranking,rows:[structuredClone(ranking.rows.find(r=>r.partyId==="MP")!)]};
  sample.rows[0].partyId="OTHER";assert.throws(()=>validateRankings(sample));
  sample.rows[0].partyId="MP";sample.rows[0].partyCode="0053";assert.throws(()=>validateRankings(sample));
});
test("all four pinned source archives reconcile nationwide and preserve the existing 2022 Riksdag dataset",()=>{
  assert.equal(data.catalog.electionIdentities,207104);
  assert.equal(data.catalog.people,142108);
  validateCatalog(data.catalog);
  assert.ok(Buffer.byteLength(JSON.stringify(data.catalog))<50_000,"The navigation catalogue must not preload candidate histories");
  const previous=JSON.parse(readFileSync("data/normalized/personal-votes-2022.json","utf8")) as PersonalVoteData;
  const rows=data.rankings.get("2022-RD")!.rows;
  assert.equal(rows.length,previous.constituencies.reduce((sum,c)=>sum+c.candidates.length,0));
  for (const c of previous.constituencies) for(const person of c.candidates){
    const actual=rows.find(r=>r.areaCode===c.code&&r.partyCode===person.partyCode&&r.id===person.id)!;
    assert.deepEqual([actual.name,actual.votes,actual.partyVotes,actual.lists],[person.name,person.votes,person.partyVotes,person.lists]);
  }
  for(const ranking of data.rankings.values()) validateRankings(ranking);
});
test("Lars Gustaf Andersson joins across party changes and keeps municipal, regional and Riksdag results separate",()=>{
  assert.equal(lars.id,"p2014-430402");
  assert.deepEqual(lars.sourceIds,["2014:430402","2018:112693","2022:46783"]);
  const rd=lars.results.filter(r=>r.electionType==="RD"&&r.areaCode==="19").sort((a,b)=>a.year-b.year);
  assert.deepEqual(rd.map(r=>[r.year,r.partyId,r.votes]),[[2014,"L",13],[2018,"L",43],[2022,"M",102]]);
  const c=compareCandidate(rd[2],lars.results);
  assert.equal(c.delta,59);assert.ok(Math.abs(c.percent!-137.2093023255814)<1e-10);
  assert.ok(c.sharePoints!<0,"Votes increased but the share of the new party fell");
  assert.equal(c.previous?.partyCode,"0003");
  assert.equal(compareCandidate(rd[1],lars.results).reason,"changed-area");
  const local=lars.results.filter(r=>r.electionType==="KF"&&r.level==="municipality").sort((a,b)=>a.year-b.year);
  assert.deepEqual(local.map(r=>[r.year,r.votes,r.partyVotes]),[[2014,109,4270],[2018,281,5261],[2022,179,13382]]);
  assert.equal(compareCandidate(local[2],lars.results).delta,-102);
  assert.equal(compareCandidate(local[1],lars.results).delta,172);
  assert.equal(lars.results.find(r=>r.year===2022&&r.electionType==="RF"&&r.level==="region")?.votes,130);
});
test("identity links require name, age compatibility, municipality and uniqueness; election candidate numbers are not global IDs",()=>{
  const a:IdentityInput={key:"2018:10",year:2018,names:["Lars Gustaf Andersson"],ages:[69],municipalities:["1490"]};
  const b:IdentityInput={key:"2022:999",year:2022,names:["Lars-Gustaf Andersson"],ages:[73],municipalities:["1490"]};
  assert.equal(linkIdentities([a,b]).length,1);
  assert.equal(linkIdentities([a,{...b,municipalities:["1427"]}]).length,2);
  assert.equal(linkIdentities([a,{...b,ages:[70]}]).length,2);
  assert.equal(linkIdentities([a,{...b,ages:[]}]).length,2);
  assert.equal(linkIdentities([a,{...b,key:"2022:10",names:["Another Candidate"]}]).length,2);
  assert.equal(linkIdentities([a,b,{...b,key:"2022:998"}]).length,3);
  assert.equal(linkIdentities([a,{...b,ages:[72,73]}]).length,2);
});
test("relative change never invents zero or infinity and respects previous-election scope",()=>{
  assert.deepEqual(voteChange(102,43),{delta:59,percent:59/43*100});
  assert.deepEqual(voteChange(10,1),{delta:9,percent:900});
  assert.deepEqual(voteChange(100,0),{delta:100,percent:null});
  assert.deepEqual(voteChange(0,0),{delta:0,percent:null});
  assert.deepEqual(voteChange(102,null),{delta:null,percent:null});
  assert.throws(()=>voteChange(-1,20));
  const r=lars.results.find(r=>r.year===2022&&r.electionType==="KF"&&r.level==="municipality")!;
  assert.equal(compareCandidate(r,lars.results.filter(p=>p.year!==2018)).reason,"no-baseline");
  assert.equal(compareCandidate({...r,supersededBy:2023},lars.results).reason,"replaced-election");
  const prior=lars.results.find(p=>p.year===2018&&p.electionType==="KF"&&p.level==="municipality")!;
  assert.equal(compareCandidate(r,[...lars.results,{...prior,partyCode:"9999"}]).reason,"multiple-parties");
  assert.equal(personalVoteShare({votes:0,partyVotes:0}),null);
});
test("leaderboards use deterministic tied ranks, current party filters and visible small baselines",()=>{
  const rows=data.rankings.get("2022-RD")!.rows.filter(r=>r.areaCode==="19"&&r.partyCode==="0001");
  assert.ok(rankCandidates(rows,"percent").some(r=>r.row.person===lars.id));
  assert.ok(!rankCandidates(rows,"percent",50).some(r=>r.row.person===lars.id));
  const source=rows.find(r=>r.person===lars.id)!;
  const create=(id:string,old:number,current:number):RankingRow=>({...source,person:id,name:id,votes:current,comparison:{...source.comparison,previous:{...source.comparison.previous!,votes:old},...voteChange(current,old)}});
  const ranked=rankCandidates([create("C",10,30),create("B",10,20),create("A",20,40),create("D",0,10)],"percent",0);
  assert.deepEqual(ranked.map(r=>[r.row.person,r.rank]),[["C",1],["A",2],["B",2]]);
  assert.ok(rankCandidates([create("D",0,10)],"delta",0).length===1);
});
test("profile shards and ranking payloads reject invalid or mixed data",()=>{
  validatePersonShard({schemaVersion:1,version:data.catalog.version,people:{[lars.id]:lars}});
  assert.match(personShard(lars.id),/^[0-9a-f]{2}$/);
  const r=data.rankings.get("2022-RD")!;
  const sample={...r,rows:[structuredClone(r.rows.find(r=>r.person===lars.id&&r.areaCode==="19")!)]};
  sample.rows[0].comparison.percent=999; assert.throws(()=>validateRankings(sample));
  sample.rows[0].year=2018;assert.throws(()=>validateRankings(sample));
  assert.throws(()=>validatePersonShard({schemaVersion:1,version:data.catalog.version,people:{wrong:lars}}));
});
test("compact universal search covers every profile without transferring complete vote histories",()=>{
  const search=buildCandidateSearch(),entries=candidateSearchEntries(search);
  assert.equal(entries.length,data.people.length);assert.ok(entries.some(e=>e.id===`candidate:${lars.id}`));
  assert.ok(gzipSync(JSON.stringify(search)).length<2_500_000,"Candidate search transfer budget");
  const broken={...search,rows:[search.rows[0],search.rows[0]]};assert.throws(()=>candidateSearchEntries(broken));
});
test("party vote arrows follow the selected election from national to municipal and verified district scope",()=>{
  const index=JSON.parse(readFileSync("data/normalized/local-election-index.json","utf8")) as LocalElectionIndex;
  const area=index.national;
  const selection=readLocalSelection("?year=2014&metric=swing&party=M",index);assert.equal(selection.year,2014);
  assert.equal(localVoteChange(area,"M",2014).delta,1453517-1791766);
  assert.equal(localVoteChange(area,"M",2010).percent,null);
  assert.notEqual(localSwing(area,"M",2014),localSwing(area,"M",2022));
});
