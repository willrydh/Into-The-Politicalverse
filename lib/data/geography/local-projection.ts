import type { LocalMap } from "./local-types";

type Position = [number, number];
export type LocalGeometry = { type: "Polygon"; coordinates: Position[][] } | { type: "MultiPolygon"; coordinates: Position[][][] };
export function projectLocalMap(features: Array<{ code: string; geometry: LocalGeometry }>, longitudeScale = 1): LocalMap {
  if (!features.length) throw new Error("Empty local map");
  const polygons = (geometry: LocalGeometry) => geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const f of features) for (const poly of polygons(f.geometry)) for (const ring of poly) for (const [x, y] of ring) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Invalid geographic coordinate");
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const width = (maxX - minX) * longitudeScale, height = maxY - minY;
  if (width <= 0 || height <= 0) throw new Error("Degenerate map bounds");
  const scale = 528 / Math.max(width, height); const round = (n: number) => String(Math.round(n * 10) / 10);
  return {
    viewBox: `0 0 ${round(width * scale + 32)} ${round(height * scale + 32)}`,
    areas: features.map(f => ({ code: f.code, path: polygons(f.geometry).flatMap(poly => poly.map(ring => ring.map(([x, y], i) => `${i ? "L" : "M"}${round(16 + (x - minX) * longitudeScale * scale)} ${round(16 + (maxY - y) * scale)}`).join("") + "Z")).join("") })),
  };
}
