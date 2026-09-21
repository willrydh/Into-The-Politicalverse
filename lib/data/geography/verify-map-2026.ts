import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { insist } from "../../live/validation";
import type { LocalMap } from "./local-types";
import preparation from "../../../data/normalized/election-preparation-2026.json";

export function verifyMap2026() {
  const manifest = JSON.parse(readFileSync("data/raw/valmyndigheten-2026/map-source-manifest.json","utf8"));
  const raw = gunzipSync(readFileSync("data/normalized/map-geometry-2026.json.gz"));
  insist(createHash("sha256").update(raw).digest("hex")===manifest.outputSha256,"2026 map checksum changed");
  const data = JSON.parse(raw.toString()) as {schemaVersion:number;boundaryYear:number;archiveSha256:string;map:LocalMap;countyMaps:Record<string,LocalMap>;districtMaps:Record<string,LocalMap>};
  insist(data.schemaVersion===1&&data.boundaryYear===2026&&data.archiveSha256===manifest.archiveSha256,"Wrong 2026 geometry provenance");
  const counties = [...new Set(preparation.municipalities.map(m=>m.code.slice(0,2)))];
  const sameCodes=(actual:string[],expected:string[])=>insist(new Set(actual).size===actual.length&&actual.length===expected.length&&actual.every(c=>expected.includes(c)),"2026 map coverage mismatch");
  sameCodes(data.map.areas.map(a=>a.code),counties); sameCodes(Object.keys(data.countyMaps),counties);
  sameCodes(Object.keys(data.districtMaps),preparation.municipalities.map(m=>m.code));
  for(const [county,map] of Object.entries(data.countyMaps))sameCodes(map.areas.map(a=>a.code),preparation.municipalities.filter(m=>m.code.startsWith(county)).map(m=>m.code));
  for(const [municipality,map] of Object.entries(data.districtMaps))sameCodes(map.areas.map(a=>a.code),preparation.districts.filter(d=>d.municipality===municipality).map(d=>d.code));
  for(const map of [data.map,...Object.values(data.countyMaps),...Object.values(data.districtMaps)])insist(/^0 0 [\d.]+ [\d.]+$/.test(map.viewBox)&&map.areas.every(a=>/^M[\d.\sMLZ-]+$/.test(a.path)),"Invalid map path");
}
