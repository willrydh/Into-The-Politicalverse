import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { digest, readSignedArchive } from "../lib/live/official-files";
import { normalizeAreaResult } from "../lib/live/area-adapter";
import { attachMapDistricts } from "../lib/live/map-district-adapter";
import { districtAsArea, districtTurnout, validateMapDistricts } from "../lib/live/map-districts";
import { verifyMap2026 } from "../lib/data/geography/verify-map-2026";
import { validateAreaFeed } from "../lib/live/public-area-feed";
import type { AreaFeed } from "../lib/live/area-types";

test("2026 polygons cover the exact official counties, municipalities and physical districts",verifyMap2026);

test("signed district ballots reconcile with area totals and preserve collection turnout",async()=>{
  const bytes=readFileSync("tests/fixtures/valmyndigheten-2026/areas/KF-1463.zip");
  const entry={url:"https://resultat.val.se/resultatfiler/val2026/p/kf/Val_2026_preliminar_1463_KF.zip",md5:digest(bytes,"md5")};
  const options={mode:"production" as const,stage:"preliminary" as const,area:{electionType:"KF" as const,code:"1463"},now:"2026-09-21T12:00:00Z",certificate:readFileSync("data/raw/valmyndigheten-2026/val-sign-crt.pem")};
  const summary=await readSignedArchive(bytes,entry,options),source=await readSignedArchive(bytes,entry,{...options,kind:"rostfordelning"});
  const result=normalizeAreaResult(summary.raw,{...options,...options.area,source:summary.source});
  attachMapDistricts(result,source.raw,source.source,options.now);
  assert.equal(result.districts!.length,result.area.totalDistricts);
  for(const d of result.districts!)assert.equal(d.votes.reduce((s,v)=>s+v,0),d.validVotes);
  const collection=result.districts!.find(d=>d.collection)!;assert.ok(collection);assert.equal(districtTurnout(collection),null);assert.equal(districtAsArea(collection).turnoutInCountedDistricts,null);
  const changed=structuredClone(result);changed.districts![0].votes[0]++;assert.throws(()=>validateMapDistricts(changed));
  const wrongScope=structuredClone(result);wrongScope.districts![0].municipality="9999";assert.throws(()=>validateMapDistricts(wrongScope));
  const mixed=structuredClone(result);mixed.districtSource!.archiveMd5="a".repeat(32);assert.throws(()=>validateMapDistricts(mixed));
  const raw=structuredClone(source.raw) as Record<string,unknown>;raw.valdatum="2022-09-11";assert.throws(()=>attachMapDistricts(structuredClone(result),raw,source.source,options.now));
});

test("accepted 2026 district map generations remain reconciled at every municipality",()=>{
  const feed=validateAreaFeed(JSON.parse(readFileSync("data/live/area-results-2026.json","utf8"))) as AreaFeed;
  const national=feed.results["final-count/RD/00"];
  assert.ok(national.districts);assert.equal(national.districts.filter(d=>!d.collection).length,6312);
  assert.equal(national.districts.reduce((s,d)=>s+d.validVotes,0),national.area.validVotes);
  const incomparable=national.districts.find(d=>!d.collection&&d.previous===null)!;
  assert.ok(incomparable);assert.equal(districtAsArea(incomparable).previous,null);
});
