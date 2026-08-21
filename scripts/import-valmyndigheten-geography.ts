import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import process from "node:process";

type ArchiveSource = {
  countyCode: string;
  countyName: string;
  url: string;
  sha256: string;
  jsonFile: string;
};

type GeographyManifest = {
  publisher: string;
  sourcePage: string;
  license: string;
  licenseUrl: string;
  retrievedAt: string;
  electionYear: number;
  geometryDate: string;
  sourceCoordinateReferenceSystem: string;
  normalizedCoordinateReferenceSystem: string;
  sourceFeatureCount: number;
  expectedMunicipalities: number;
  normalizer: string;
  normalizedSha256?: string;
  archives: ArchiveSource[];
};

type Position = [number, number];
type PolygonGeometry = { type: "Polygon"; coordinates: Position[][] };
type MultiPolygonGeometry = { type: "MultiPolygon"; coordinates: Position[][][] };
type MunicipalityGeometry = PolygonGeometry | MultiPolygonGeometry;

type MapshaperFeature = {
  type: "Feature";
  properties: { municipalityCode?: string };
  geometry: MunicipalityGeometry;
};

type SourceFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{ properties: { Lkfv?: string } }>;
};

type ElectionMunicipality = { code: string; name: string };

const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST_PATH = join(ROOT, "data/raw/valmyndigheten/geography-source-manifest.json");
const ELECTION_PATH = join(ROOT, "data/normalized/riksdag-2022.json");
const DEFAULT_SOURCE_DIR = join(ROOT, "data/raw/downloads/valmyndigheten-geography-2022");
const OUTPUT_PATH = join(ROOT, "data/normalized/municipality-boundaries-2022.geojson");

function sourceDirectory(): string {
  const sourceIndex = process.argv.indexOf("--source-dir");
  if (sourceIndex >= 0 && process.argv[sourceIndex + 1]) return resolve(process.argv[sourceIndex + 1]);
  return DEFAULT_SOURCE_DIR;
}

function sha256(contents: Buffer | string): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function download(url: string, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Valmyndigheten geography download failed: ${response.status} ${response.statusText}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

function assertCoordinate(position: Position, code: string): void {
  const [longitude, latitude] = position;
  if (longitude < 10 || longitude > 25 || latitude < 54 || latitude > 70) {
    throw new Error(`Municipality ${code} contains an out-of-bounds WGS 84 coordinate: ${longitude}, ${latitude}`);
  }
}

function assertGeometry(geometry: MunicipalityGeometry, code: string): void {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  if (!polygons.length) throw new Error(`Municipality ${code} has empty geometry`);

  for (const polygon of polygons) {
    if (!polygon.length || polygon[0].length < 4) throw new Error(`Municipality ${code} has an invalid polygon`);
    for (const ring of polygon) for (const position of ring) assertCoordinate(position, code);
  }
}

async function main(): Promise<void> {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as GeographyManifest;
  const election = JSON.parse(await readFile(ELECTION_PATH, "utf8")) as { municipalities: ElectionMunicipality[] };
  const sourceDir = sourceDirectory();
  const workDir = await mkdtemp(join(tmpdir(), "politicalverse-geography-"));
  const extractedDir = join(workDir, "extracted");
  const mapshaperOutput = join(workDir, "municipalities.geojson");

  await mkdir(sourceDir, { recursive: true });
  await mkdir(extractedDir, { recursive: true });

  try {
    let sourceFeatureCount = 0;
    const sourceFiles: string[] = [];

    for (const archive of manifest.archives) {
      const archivePath = join(sourceDir, basename(new URL(archive.url).pathname));
      if (!existsSync(archivePath)) await download(archive.url, archivePath);

      const archiveContents = await readFile(archivePath);
      const actualChecksum = sha256(archiveContents);
      if (actualChecksum !== archive.sha256) {
        throw new Error(`${archive.countyName} checksum mismatch: ${actualChecksum}`);
      }

      execFileSync("unzip", ["-q", "-o", archivePath, "-d", extractedDir], { stdio: "inherit" });
      const sourcePath = join(extractedDir, archive.jsonFile);
      const source = JSON.parse(await readFile(sourcePath, "utf8")) as SourceFeatureCollection;
      sourceFeatureCount += source.features.length;

      for (const feature of source.features) {
        if (!feature.properties.Lkfv?.startsWith(archive.countyCode)) {
          throw new Error(`${archive.countyName} contains an unexpected district code`);
        }
      }
      sourceFiles.push(sourcePath);
    }

    if (sourceFeatureCount !== manifest.sourceFeatureCount) {
      throw new Error(`Source feature count mismatch: ${sourceFeatureCount}`);
    }

    const mapshaperBin = join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "mapshaper.cmd" : "mapshaper");
    execFileSync(
      mapshaperBin,
      [
        ...sourceFiles,
        "combine-files",
        "-merge-layers",
        "force",
        "name=municipalities",
        "-each",
        "municipalityCode=Lkfv.substr(0,4)",
        "-clean",
        "-dissolve",
        "municipalityCode",
        "-simplify",
        "5%",
        "keep-shapes",
        "-proj",
        "init=EPSG:3006",
        "crs=EPSG:4326",
        "-o",
        "format=geojson",
        "precision=0.0001",
        mapshaperOutput,
      ],
      { stdio: "inherit" },
    );

    const mapshaperData = JSON.parse(await readFile(mapshaperOutput, "utf8")) as {
      type: "FeatureCollection";
      features: MapshaperFeature[];
    };
    const municipalityNames = new Map(election.municipalities.map((municipality) => [municipality.code, municipality.name]));
    const normalizedFeatures = mapshaperData.features
      .map((feature) => {
        const code = feature.properties.municipalityCode;
        const name = code ? municipalityNames.get(code) : undefined;
        if (!code || !name) throw new Error(`Geometry could not be joined to municipality ${code ?? "<missing>"}`);
        assertGeometry(feature.geometry, code);
        return { type: "Feature" as const, properties: { code, name }, geometry: feature.geometry };
      })
      .sort((left, right) => left.properties.code.localeCompare(right.properties.code));

    if (normalizedFeatures.length !== manifest.expectedMunicipalities) {
      throw new Error(`Municipality geometry count mismatch: ${normalizedFeatures.length}`);
    }
    const geometryCodes = new Set(normalizedFeatures.map((feature) => feature.properties.code));
    const missingCodes = election.municipalities.map((municipality) => municipality.code).filter((code) => !geometryCodes.has(code));
    if (missingCodes.length) throw new Error(`Missing municipality geometry: ${missingCodes.join(", ")}`);

    const normalized = {
      type: "FeatureCollection",
      schemaVersion: 1,
      source: {
        publisher: manifest.publisher,
        dataset: "Valdistrikt i val 2022 — kartor, dissolved to municipality boundaries",
        sourceUrl: manifest.sourcePage,
        retrievedAt: manifest.retrievedAt,
        geometryDate: manifest.geometryDate,
        sourceCoordinateReferenceSystem: manifest.sourceCoordinateReferenceSystem,
        normalizedCoordinateReferenceSystem: manifest.normalizedCoordinateReferenceSystem,
        attribution: "Valmyndigheten; source geometry supplied by the county administrative boards",
        classification: "OFFICIAL",
        transformation: `${manifest.normalizer}: clean, dissolve by municipality code, retain 5% of removable vertices, reproject to WGS 84`,
      },
      features: normalizedFeatures,
    };
    const output = `${JSON.stringify(normalized)}\n`;
    const outputChecksum = sha256(output);
    if (manifest.normalizedSha256 && outputChecksum !== manifest.normalizedSha256) {
      throw new Error(`Normalized geography checksum mismatch: ${outputChecksum}`);
    }

    await writeFile(OUTPUT_PATH, output);
    console.log(`Normalized ${sourceFeatureCount.toLocaleString("en-US")} districts into ${normalizedFeatures.length} municipality boundaries.`);
    console.log(`Normalized SHA-256: ${outputChecksum}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

await main();
