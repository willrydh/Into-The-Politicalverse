import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { getCandidateData, buildCandidateSearch } from "../lib/candidates/build";
import { linkIdentities, type IdentityInput } from "../lib/candidates/identity";
import { compareCandidate, rankCandidates, voteChange, personalVoteShare } from "../lib/candidates/math";
import { validateCatalog, validatePersonShard, validateRankings } from "../lib/candidates/validation";
import { candidateSearchEntries } from "../lib/candidates/search";
import { summarizeBallotPositions, validateBallotPositions } from "../lib/candidates/ballots";
import { type RankingRow, personShard } from "../lib/candidates/types";
import { localVoteChange, localSwing } from "../lib/data/geography/local-math";
import { readLocalSelection } from "../lib/data/geography/local-selection";
import type { LocalElectionIndex } from "../lib/data/geography/local-types";
import type { PersonalVoteData } from "../lib/data/geography/personal-votes";

const data=getCandidateData();
const lars=data.sourcePeople.get("2022:46783")!;
test("Jonas Attenius has printed list positions 10, 4 and 1 alongside the official municipal vote counts",()=>{
  const jonas=data.sourcePeople.get("2022:50618")!;
  const results=jonas.results.filter(r=>r.electionType==="KF"&&r.level==="municipality"&&r.areaCode==="1480").sort((a,b)=>a.year-b.year);
  assert.deepEqual(results.map(r=>[r.year,r.votes,r.ballotPositions]),[
    [2014,183,[{listNumber:"0002-07735",position:10}]],
    [2018,545,[{listNumber:"0002-13869",position:4}]],
    [2022,3720,[{listNumber:"0002-04106",position:1}]],
  ]);
  assert.equal(results[0].lists,4,"Four constituency observations of one printed list must not become four different lists");
  const ranking=data.rankings.get("2022-KF")!.rows.find(r=>r.id==="50618"&&r.areaCode==="1480")!;
  assert.deepEqual(ranking.comparison.previous?.ballotPositions,results[1].ballotPositions);
  assert.equal(ranking.comparison.delta,3175);
  assert.equal(ranking.comparison.percent,3175/545*100);
});
test("multiple printed lists retain all positions instead of choosing the best or averaging",()=>{
  const row=data.rankings.get("2014-KF")!.rows.find(r=>r.id==="541067"&&r.areaCode==="0114")!;
  assert.deepEqual(row.ballotPositions,[{listNumber:"0110-09899",position:6},{listNumber:"0110-10574",position:6},{listNumber:"0110-10576",position:1}]);
  assert.deepEqual(summarizeBallotPositions(row.ballotPositions),{positions:[1,6],lists:3});
  assert.deepEqual(summarizeBallotPositions([]),{positions:[],lists:0});
  for(const person of data.people) for(const result of person.results) {
    if(result.level==="constituency")continue;
    const children=person.results.filter(r=>r.year===result.year&&r.electionType===result.electionType&&r.level==="constituency"&&r.areaCode.startsWith(result.areaCode)&&r.partyCode===result.partyCode);
    const pairs=(rows:typeof children)=>[...new Set(rows.flatMap(r=>r.ballotPositions.map(b=>`${b.listNumber}:${b.position}`)))].sort();
    assert.deepEqual(pairs([result]),pairs(children),"Aggregate list positions must match their source constituencies");
  }
});
test("ballot metadata rejects invalid, duplicated and cross-party positions, including previous elections",()=>{
  for(const position of [0,-1,1.5,NaN,Infinity,"1",null]) assert.throws(()=>validateBallotPositions([{listNumber:"0002-13869",position}],"0002"));
  assert.throws(()=>validateBallotPositions(undefined,"0002"));
  assert.throws(()=>validateBallotPositions([{listNumber:"0001-13869",position:4}],"0002"));
  assert.throws(()=>validateBallotPositions([{listNumber:"0002-13869",position:4},{listNumber:"0002-13869",position:4}],"0002"));
  const ranking=data.rankings.get("2022-KF")!;
  const sample={...ranking,rows:[structuredClone(ranking.rows.find(r=>r.id==="50618"&&r.areaCode==="1480")!)]};
  sample.rows[0].comparison.previous!.ballotPositions[0].position=0;
  assert.throws(()=>validateRankings(sample));
  const rd=lars.results.find(r=>r.year===2022&&r.electionType==="RD"&&r.areaCode==="19")!;
  assert.ok(compareCandidate(rd,lars.results).previous!.ballotPositions.every(b=>b.listNumber.startsWith("0003-")));
  assert.ok(rd.ballotPositions.every(b=>b.listNumber.startsWith("0001-")));
});
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

// Leaderboard v1 and the profile achievement index share the exact same cohorts.
import { candidateLeaderboard, DEFAULT_RANKING_METRIC, LEADERBOARD_METHOD, standingLabel } from "../lib/candidates/leaderboards";
import { buildStandings } from "../lib/candidates/build-standings";
import { standingsHref, validateStandings, type StandingsShard } from "../lib/candidates/standings";
import { compactCandidateNumber } from "../lib/candidates/format";

test("total votes is the default and RD sums distinct constituencies once per candidate and party",()=>{
  assert.equal(DEFAULT_RANKING_METRIC,"votes");
  const rows=data.rankings.get("2022-RD")!.rows, ranked=candidateLeaderboard(rows,"votes");
  assert.equal(ranked.length,new Set(rows.map(r=>`${r.person}:${r.partyCode}`)).size);
  assert.equal(ranked.reduce((sum,e)=>sum+e.votes,0),rows.reduce((sum,r)=>sum+r.votes,0));
  const jimmie=ranked.find(e=>e.row.name==="Jimmie Åkesson")!;
  assert.equal(jimmie.members.length,29);assert.equal(jimmie.rank,1);
  assert.equal(jimmie.votes,rows.filter(r=>r.person===jimmie.row.person&&r.partyCode===jimmie.row.partyCode).reduce((sum,r)=>sum+r.votes,0));
  const county=rows.filter(r=>r.county==="14");
  const local=candidateLeaderboard(county,"votes").find(e=>e.row.person===jimmie.row.person)!;
  assert.equal(local.members.length,5);
  assert.equal(local.votes,county.filter(r=>r.person===jimmie.row.person).reduce((sum,r)=>sum+r.votes,0));
  const area=rows.filter(r=>r.areaCode==="19");
  assert.deepEqual(candidateLeaderboard(area,"votes").map(e=>[e.row.person,e.rank,e.votes]),rankCandidates(area,"votes").map(e=>[e.row.person,e.rank,e.row.votes]));
  assert.throws(()=>candidateLeaderboard([rows[0],rows[0]],"votes"));
  assert.throws(()=>candidateLeaderboard([rows[0],{...rows[1],year:2018}],"votes"));
  const changedParty={...rows[0],partyCode:"9999",votes:10};
  assert.equal(candidateLeaderboard([rows[0],changedParty],"votes").length,2,"Do not silently merge different parties");
});

test("RD aggregate ties retain competition ranks and source observations stay untouched",()=>{
  const source=data.rankings.get("2022-RD")!.rows[0];
  const make=(person:string,areaCode:string,votes:number)=>({...source,person,areaCode,votes});
  const rows=[make("p2022-1","01",60),make("p2022-1","02",40),make("p2022-2","01",100),make("p2022-3","01",20)];
  const before=structuredClone(rows);
  assert.deepEqual(candidateLeaderboard(rows,"votes").map(e=>[e.rank,e.votes]),[[1,100],[1,100],[3,20]]);
  assert.deepEqual(rows,before);
});

test("down-ballot support requires 100 votes, every reported position >=4, and uses the actual party denominator",()=>{
  const source=data.rankings.get("2022-KF")!.rows.find(r=>r.id==="50618"&&r.areaCode==="1480")!;
  const base={...source,votes:100,partyVotes:1000,ballotPositions:[{listNumber:"0002-12345",position:4}]};
  assert.equal(rankCandidates([base],"support")[0].row.votes,100);
  for(const position of [1,2,3]) assert.equal(rankCandidates([{...base,ballotPositions:[{listNumber:"0002-12345",position}]}],"support").length,0);
  for(const position of [4,5,6]) assert.equal(rankCandidates([{...base,ballotPositions:[{listNumber:"0002-12345",position}]}],"support").length,1);
  assert.equal(rankCandidates([{...base,ballotPositions:[{listNumber:"0002-12345",position:3},{listNumber:"0002-23456",position:20}]}],"support").length,0);
  assert.equal(rankCandidates([{...base,ballotPositions:[{listNumber:"0002-12345",position:4},{listNumber:"0002-23456",position:20}]}],"support").length,1);
  assert.equal(rankCandidates([{...base,votes:99}],"support").length,0);
  assert.equal(rankCandidates([{...base,ballotPositions:[]}],"support").length,0);
  assert.equal(rankCandidates([{...base,ballotPositions:[...base.ballotPositions,{listNumber:"0002-23456",position:1}]}],"support").length,0);
  assert.equal(rankCandidates([{...base,supersededBy:2023}],"support").length,0);
  assert.equal(rankCandidates([{...base,partyVotes:0}],"support").length,0);
  assert.equal(rankCandidates([{...base,comparison:{reason:"no-baseline",previous:null,delta:null,percent:null,sharePoints:null}}],"support",100).length,1,"New and unmatched candidates need no prior result");
  const smaller={...base,person:"p2022-2",votes:120,partyVotes:2000};
  assert.equal(candidateLeaderboard([smaller,base],"support")[0].row.person,base.person,"10% precedes 6%, despite fewer votes");
  assert.equal(candidateLeaderboard([source],"support").length,0,"Attenius on printed position 1 is not a down-ballot candidate");
  const jonas2018=data.rankings.get("2018-KF")!.rows.find(r=>r.person===source.person&&r.areaCode==="1480")!;
  assert.deepEqual(jonas2018.ballotPositions.map(b=>b.position),[4]);
  assert.equal(candidateLeaderboard([jonas2018],"support")[0].votes,545,"Printed position 4 now qualifies without changing the official votes");
});

test("profile tiers and compact changes have exact display boundaries, without changing the numeric data",()=>{
  for(const bad of [0,-1,101,1.5,NaN])assert.equal(standingLabel(bad,true),null);
  assert.equal(standingLabel(1,true),"#1");assert.equal(standingLabel(49,true),"#49");
  assert.equal(standingLabel(50,true),"Topp 50");assert.equal(standingLabel(51,true),"Topp 100");assert.equal(standingLabel(100,false),"Top 100");
  assert.equal(compactCandidateNumber(13400,true),"13,4t");
  assert.equal(compactCandidateNumber(13400,false),"13.4k");
  assert.equal(compactCandidateNumber(-13400,true),"−13,4t");
  assert.equal(compactCandidateNumber(45.5,true),"45,5");
  assert.equal(compactCandidateNumber(1200000,true),"1,2M");
});

test("profile standings match full real leaderboards before filtering to the profile, across years, parties and scopes",()=>{
  const standings=buildStandings(data.people,data.rankings.values());
  const newlyEligible=standings.get(data.sourcePeople.get("2022:56524")!.id)!.find(r=>r.year===2022&&r.election==="KF"&&r.area==="1492")!;
  assert.ok(newlyEligible.ranks.some(r=>r[0]==="support"&&r[1]==="area"),"Position-4 candidates receive regenerated profile standings");
  for(const id of [lars.id,data.sourcePeople.get("2022:56524")!.id,data.sourcePeople.get("2022:50618")!.id,data.rankings.get("2022-RD")!.rows.find(r=>r.name==="Jimmie Åkesson")!.person]) {
    const records=standings.get(id)!;
    const shard:StandingsShard={schemaVersion:1,method:LEADERBOARD_METHOD,sourceVersion:data.catalog.version,classification:"DERIVED",people:{[id]:records}};
    validateStandings(shard);
    for(const record of records)for(const standing of record.ranks) {
      const [metric,scope,partyOnly,rank,total]=standing;
      const rows=data.rankings.get(`${record.year}-${record.election}`)!.rows;
      const subject=rows.find(r=>r.person===id&&r.areaCode===record.area&&r.partyCode===record.party)!;
      const filtered=rows.filter(r=>(scope==="national"||scope==="county"&&r.county===subject.county||scope==="area"&&r.areaCode===record.area)&&(!partyOnly||r.partyCode===record.party));
      const expected=candidateLeaderboard(filtered,metric,1);
      const actual=expected.find(e=>e.members.some(r=>r.person===id&&r.areaCode===record.area&&r.partyCode===record.party))!;
      assert.equal(rank,actual.rank);assert.equal(total,expected.length);assert.ok(rank<=100);
      const url=new URL(standingsHref(id,record,standing,subject.county),"https://politicalverse.se");
      assert.equal(url.searchParams.get("metric"),metric);assert.equal(url.searchParams.get("year"),String(record.year));
      assert.equal(url.searchParams.get("election"),record.election);assert.equal(url.searchParams.get("candidate"),id);
      assert.equal(url.searchParams.get("minimum"),"1");
      assert.equal(url.searchParams.get("party"),partyOnly?record.party:null);
      assert.equal(url.searchParams.get("county"),scope==="county"?subject.county:null);
      assert.equal(url.searchParams.get("area"),scope==="area"?record.area:null);
    }
    assert.ok(gzipSync(JSON.stringify(shard)).length<15000,"An individual profile must not carry a leaderboard dataset");
    const bad=structuredClone(shard);bad.method="old-method";assert.throws(()=>validateStandings(bad));
    const badRank=structuredClone(shard);badRank.people[id][0].ranks[0][3]=101;assert.throws(()=>validateStandings(badRank));
    const duplicate=structuredClone(shard);duplicate.people[id][0].ranks.push(duplicate.people[id][0].ranks[0]);assert.throws(()=>validateStandings(duplicate));
  }
  assert.equal(standings.size,data.people.length,"An empty achievement array is distinct from a failed download");
});

test("profile top-100 clipping keeps every tied candidate at the boundary and omits lower ranks",()=>{
  const source=data.rankings.get("2022-RD")!.rows[0];
  const rows=Array.from({length:102},(_,i)=>({...source,person:`p2022-${i+1}`,name:`Candidate ${String(i).padStart(3,"0")}`,areaCode:"01",county:"01",votes:102-i,ballotPositions:[],comparison:{reason:"no-baseline" as const,previous:null,delta:null,percent:null,sharePoints:null}}));
  const people=rows.map(r=>({id:r.person,name:r.name,aliases:[r.name],sourceIds:[`2022:${r.id}`],linked:false,results:[r]}));
  const payload={...data.rankings.get("2022-RD")!,rows};
  const separate=buildStandings(people,[payload]);
  assert.deepEqual(separate.get("p2022-102"),[]);
  rows[100].votes=3;rows[101].votes=3;
  const tied=buildStandings(people,[payload]);
  for(const id of ["p2022-100","p2022-101","p2022-102"]) {
    const national=tied.get(id)![0].ranks.find(s=>s[0]==="votes"&&s[1]==="national"&&s[2]===0)!;
    assert.deepEqual(national,["votes","national",0,100,102]);
  }
});
