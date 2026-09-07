import { createHash } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { selectForecastReference, type ForecastReference } from "../lib/forecast/reference";

const root = resolve(import.meta.dirname, "..");
const path = resolve(root, "data/normalized/election-forecast-reference-2026.json");
const contents = await readFile(resolve(root, "data/normalized/election-forecast-2026.json"), "utf8");
const manifest = JSON.parse(await readFile(resolve(root, "data/raw/polls/source-manifest.json"), "utf8"));
const hash = createHash("sha256").update(contents).digest("hex");
if (hash !== manifest.normalizedForecastSha256) throw new Error("Forecast checksum mismatch; reference retained");
let previous: ForecastReference | null = null;
try { previous = JSON.parse(await readFile(path, "utf8")); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
if (previous && createHash("sha256").update(`${JSON.stringify(previous.forecast, null, 2)}\n`).digest("hex") !== previous.forecastSha256) throw new Error("Stored reference checksum mismatch");
const next = selectForecastReference(previous, JSON.parse(contents), hash, new Date().toISOString());
if (next !== previous) {
  const temporary = `${path}.incoming-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`);
  await rename(temporary, path);
}
console.log(`Pre-election reference retained: ${next.forecast.snapshotId}; cutoff ${next.forecast.model.dataCutoff}; freeze ${next.freezeAt}`);
