import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getElection, getMunicipalityComparisons, getPartyChange, getPartyResult, municipalityHistory2018, riksdag2022 } from "@/lib/data/elections";
import { PARTY_ORDER } from "@/lib/data/elections/parties";
import type { PartyId } from "@/lib/data/elections/types";

type Position = [number, number];
type PolygonGeometry = { type: "Polygon"; coordinates: Position[][] };
type MultiPolygonGeometry = { type: "MultiPolygon"; coordinates: Position[][][] };
type MunicipalityGeometry = PolygonGeometry | MultiPolygonGeometry;

type MunicipalityFeatureCollection = {
  type: "FeatureCollection";
  schemaVersion: 1;
  source: {
    publisher: string;
    dataset: string;
    sourceUrl: string;
    retrievedAt: string;
    geometryDate: string;
    attribution: string;
    classification: "OFFICIAL";
    transformation: string;
  };
  features: Array<{
    type: "Feature";
    properties: { code: string; name: string };
    geometry: MunicipalityGeometry;
  }>;
};

export type MunicipalityMapArea = {
  code: string;
  name: string;
  path: string;
  turnout: number;
  previousTurnout: number;
  turnoutChange: number;
  validVotes: number;
  totalVotes: number;
  winner: Exclude<PartyId, "OTHER">;
  shares: Partial<Record<Exclude<PartyId, "OTHER">, number>>;
  previousShares: Partial<Record<Exclude<PartyId, "OTHER">, number>>;
  swings: Partial<Record<Exclude<PartyId, "OTHER">, number>>;
};

export type MunicipalityMapModel = {
  viewBox: string;
  width: number;
  height: number;
  areas: MunicipalityMapArea[];
  nationalShares: Partial<Record<Exclude<PartyId, "OTHER">, number>>;
  nationalSwings: Partial<Record<Exclude<PartyId, "OTHER">, number>>;
  nationalTurnout: number;
  nationalTurnoutChange: number;
  source: {
    results2022: typeof riksdag2022.source;
    results2018: typeof municipalityHistory2018.source;
    geometry: MunicipalityFeatureCollection["source"];
    comparison: typeof municipalityHistory2018.geographyComparison;
  };
};

const GEOMETRY_PATH = join(process.cwd(), "data/normalized/municipality-boundaries-2022.geojson");
const MAP_WIDTH = 560;
const MAP_PADDING = 14;
const REFERENCE_LATITUDE = 62;
const LONGITUDE_SCALE = Math.cos((REFERENCE_LATITUDE * Math.PI) / 180);
const MAP_PARTIES = PARTY_ORDER.filter((partyId): partyId is Exclude<PartyId, "OTHER"> => partyId !== "OTHER");

function polygons(geometry: MunicipalityGeometry): Position[][][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function allPositions(geometry: MunicipalityGeometry): Position[] {
  return polygons(geometry).flat(2) as Position[];
}

function rounded(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}

export function getMunicipalityMapModel(): MunicipalityMapModel {
  const geometry = JSON.parse(readFileSync(GEOMETRY_PATH, "utf8")) as MunicipalityFeatureCollection;
  const positions = geometry.features.flatMap((feature) => allPositions(feature.geometry));
  let minimumLongitude = Number.POSITIVE_INFINITY;
  let maximumLongitude = Number.NEGATIVE_INFINITY;
  let minimumLatitude = Number.POSITIVE_INFINITY;
  let maximumLatitude = Number.NEGATIVE_INFINITY;
  for (const [longitude, latitude] of positions) {
    minimumLongitude = Math.min(minimumLongitude, longitude);
    maximumLongitude = Math.max(maximumLongitude, longitude);
    minimumLatitude = Math.min(minimumLatitude, latitude);
    maximumLatitude = Math.max(maximumLatitude, latitude);
  }
  const longitudeRange = (maximumLongitude - minimumLongitude) * LONGITUDE_SCALE;
  const latitudeRange = maximumLatitude - minimumLatitude;
  const scale = (MAP_WIDTH - MAP_PADDING * 2) / longitudeRange;
  const height = Math.round(latitudeRange * scale + MAP_PADDING * 2);
  const resultsByCode = new Map(riksdag2022.municipalities.map((municipality) => [municipality.code, municipality]));
  const comparisonsByCode = new Map(getMunicipalityComparisons().map((comparison) => [comparison.code, comparison]));

  function project([longitude, latitude]: Position): [number, number] {
    return [
      MAP_PADDING + (longitude - minimumLongitude) * LONGITUDE_SCALE * scale,
      MAP_PADDING + (maximumLatitude - latitude) * scale,
    ];
  }

  function pathForGeometry(value: MunicipalityGeometry): string {
    return polygons(value)
      .flatMap((polygon) =>
        polygon.map((ring) => {
          const projected = ring.map(project);
          return `${projected.map(([x, y], index) => `${index === 0 ? "M" : "L"}${rounded(x)} ${rounded(y)}`).join("")}Z`;
        }),
      )
      .join("");
  }

  const areas = geometry.features.map((feature) => {
    const result = resultsByCode.get(feature.properties.code);
    if (!result) throw new Error(`Missing result for municipality geometry ${feature.properties.code}`);
    const comparison = comparisonsByCode.get(feature.properties.code);
    if (!comparison) throw new Error(`Missing comparable 2018 result for municipality geometry ${feature.properties.code}`);
    const ranking = MAP_PARTIES.map((partyId) => getPartyResult(result, partyId)).sort((left, right) => right.share - left.share);

    return {
      code: result.code,
      name: result.name,
      path: pathForGeometry(feature.geometry),
      turnout: result.turnout,
      previousTurnout: comparison.previous.turnout,
      turnoutChange: comparison.turnoutChange,
      validVotes: result.validVotes,
      totalVotes: result.totalVotes,
      winner: ranking[0].partyId as Exclude<PartyId, "OTHER">,
      shares: Object.fromEntries(MAP_PARTIES.map((partyId) => [partyId, getPartyResult(result, partyId).share])),
      previousShares: Object.fromEntries(MAP_PARTIES.map((partyId) => [partyId, getPartyResult(comparison.previous, partyId).share])),
      swings: Object.fromEntries(MAP_PARTIES.map((partyId) => [partyId, comparison.swings[partyId]])),
    };
  });

  return {
    viewBox: `0 0 ${MAP_WIDTH} ${height}`,
    width: MAP_WIDTH,
    height,
    areas,
    nationalShares: Object.fromEntries(MAP_PARTIES.map((partyId) => [partyId, getPartyResult(riksdag2022.national, partyId).share])),
    nationalSwings: Object.fromEntries(MAP_PARTIES.map((partyId) => [partyId, getPartyChange(partyId)])),
    nationalTurnout: riksdag2022.national.turnout,
    nationalTurnoutChange: Number((riksdag2022.national.turnout - getElection(2018).turnout).toFixed(2)),
    source: {
      results2022: riksdag2022.source,
      results2018: municipalityHistory2018.source,
      geometry: geometry.source,
      comparison: municipalityHistory2018.geographyComparison,
    },
  };
}
