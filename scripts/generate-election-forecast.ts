import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NationalHistoryData } from "../lib/data/elections/types";
import { generateElectionForecast, validateForecastInputs } from "../lib/forecast/model";
import { parsePollCsv } from "../lib/forecast/polls";

const ROOT = resolve(import.meta.dirname, "..");
const RAW_PATH = resolve(ROOT, "data/raw/polls/SwedishPolls.csv");
const MANIFEST_PATH = resolve(ROOT, "data/raw/polls/source-manifest.json");
const HISTORY_PATH = resolve(ROOT, "data/normalized/riksdag-national-history.json");
const OUTPUT_PATH = resolve(ROOT, "data/normalized/election-forecast-2026.json");

type PollManifest = {
  schemaVersion: 1;
  repositoryUrl: string;
  rawUrl: string;
  sourceCommit: string;
  retrievedAt: string;
  snapshotCreatedAt: string;
  classification: "POLL";
  license: "CC0-1.0";
  rawSha256: string;
  expectedRows: number;
  latestPollPublication: string;
  normalizedForecastSha256?: string;
  primaryCrossChecks: Array<{
    publisher: string;
    publishedAt: string;
    url: string;
    expected: Record<string, number>;
  }>;
};

function assertPrimaryCrossChecks(polls: ReturnType<typeof parsePollCsv>, manifest: PollManifest): void {
  const aliases: Record<string, string[]> = {
    Novus: ["Novus"],
    "SVT/Verian": ["Sifo", "Verian"],
    SCB: ["SCB"],
  };
  for (const crossCheck of manifest.primaryCrossChecks) {
    const poll = polls.find((observation) => (
      observation.publishedAt === crossCheck.publishedAt
      && (aliases[crossCheck.publisher] ?? [crossCheck.publisher]).includes(observation.company)
    ));
    if (!poll) throw new Error(`Primary cross-check ${crossCheck.publisher} ${crossCheck.publishedAt} was not found`);
    for (const [key, expected] of Object.entries(crossCheck.expected)) {
      const actual = key === "n" ? poll.sampleSize : poll.shares[key as keyof typeof poll.shares];
      if (actual !== expected) throw new Error(`Primary cross-check ${crossCheck.publisher} ${key}: expected ${expected}, received ${actual ?? "missing"}`);
    }
  }
}

const [rawContents, manifestContents, historyContents] = await Promise.all([
  readFile(RAW_PATH, "utf8"),
  readFile(MANIFEST_PATH, "utf8"),
  readFile(HISTORY_PATH, "utf8"),
]);
const manifest = JSON.parse(manifestContents) as PollManifest;
const history = JSON.parse(historyContents) as NationalHistoryData;
const rawSha256 = createHash("sha256").update(rawContents).digest("hex");
if (rawSha256 !== manifest.rawSha256) throw new Error(`Poll snapshot checksum ${rawSha256} does not match manifest ${manifest.rawSha256}`);
const polls = parsePollCsv(rawContents);
if (polls.length !== manifest.expectedRows) throw new Error(`Expected ${manifest.expectedRows} polls, received ${polls.length}`);
validateForecastInputs(polls, manifest.latestPollPublication);
assertPrimaryCrossChecks(polls, manifest);

const forecast = generateElectionForecast({
  polls,
  history: history.elections,
  dataCutoff: manifest.latestPollPublication,
  generatedAt: manifest.snapshotCreatedAt,
  source: {
    dataset: "SwedishPolls",
    classification: "POLL",
    repositoryUrl: manifest.repositoryUrl,
    rawUrl: manifest.rawUrl,
    upstreamCommit: manifest.sourceCommit,
    rawSha256: manifest.rawSha256,
    license: manifest.license,
    retrievedAt: manifest.retrievedAt,
    primaryCrossChecks: manifest.primaryCrossChecks.map(({ publisher, publishedAt, url }) => ({ publisher, publishedAt, url, validated: true })),
  },
});
const output = `${JSON.stringify(forecast, null, 2)}\n`;
await writeFile(OUTPUT_PATH, output, "utf8");
const outputSha256 = createHash("sha256").update(output).digest("hex");
const updatedManifest = { ...manifest, normalizedForecastSha256: outputSha256 };
await writeFile(MANIFEST_PATH, `${JSON.stringify(updatedManifest, null, 2)}\n`, "utf8");
console.log(
  `Generated ${forecast.model.simulations.toLocaleString("en-US")} deterministic election simulations from ${forecast.evidence.currentWindowPolls} current-window polls; forecast SHA-256 ${outputSha256}.`,
);
