import "server-only";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { cache } from "react";
import type { LocalMap } from "./local-types";

type Maps = { schemaVersion: 1; boundaryYear: 2026; archiveSha256: string; map: LocalMap; countyMaps: Record<string,LocalMap>; districtMaps: Record<string,LocalMap> };
const getMaps = cache((): Maps => JSON.parse(gunzipSync(readFileSync("data/normalized/map-geometry-2026.json.gz")).toString()));
export function getMap2026(code: string) {
  const data = getMaps();
  const map = code === "SE" ? data.map : code.length === 2 ? data.countyMaps[code] : data.districtMaps[code];
  if (!map) throw new Error(`Unknown 2026 map ${code}`);
  return { schemaVersion: data.schemaVersion, boundaryYear: data.boundaryYear, archiveSha256: data.archiveSha256, code, map };
}
export function mapCodes2026() { const data = getMaps(); return ["SE",...Object.keys(data.countyMaps),...Object.keys(data.districtMaps)]; }
