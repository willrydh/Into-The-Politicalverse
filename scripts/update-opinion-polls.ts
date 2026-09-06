import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NationalHistoryData } from "../lib/data/elections/types";
import { dateInTimeZone, isIsoDateStamp } from "../lib/dates";
import { FORECAST_ELECTION_DATE, generateElectionForecast, validateForecastInputs } from "../lib/forecast/model";
import { hasCompleteModernShares, parsePollCsv } from "../lib/forecast/polls";
import type { PollObservation } from "../lib/forecast/types";
import { POLLS_ADAPTER_VERSION, PUBLICATION_DATE_CORRECTIONS } from "../lib/forecast/source-corrections";

const ROOT = resolve(import.meta.dirname, "..");
const RAW_PATH = resolve(ROOT, "data/raw/polls/SwedishPolls.csv");
const MANIFEST_PATH = resolve(ROOT, "data/raw/polls/source-manifest.json");
const HISTORY_PATH = resolve(ROOT, "data/normalized/riksdag-national-history.json");
const FORECAST_PATH = resolve(ROOT, "data/normalized/election-forecast-2026.json");
const UPSTREAM_FILE_PATH = "Data/Polls.csv";
const UPSTREAM_REPOSITORY_URL = "https://github.com/MansMeg/SwedishPolls";
const UPSTREAM_MASTER_RAW_URL = "https://raw.githubusercontent.com/MansMeg/SwedishPolls/master/Data/Polls.csv";
const UPSTREAM_COMMITS_URL = `https://api.github.com/repos/MansMeg/SwedishPolls/commits?path=${encodeURIComponent(UPSTREAM_FILE_PATH)}&sha=master&per_page=1`;

type PrimaryCrossCheck = {
  publisher: string;
  publishedAt: string;
  url: string;
  expected: Record<string, number>;
};

type PollManifest = {
  schemaVersion: 1;
  dataset: string;
  publisher: string;
  repositoryUrl: string;
  rawUrl: string;
  sourceCommit: string;
  sourceCommitDate: string;
  retrievedAt: string;
  snapshotCreatedAt: string;
  classification: "POLL";
  license: "CC0-1.0";
  rawSha256: string;
  expectedRows: number;
  latestPollPublication: string;
  primaryCrossChecks: PrimaryCrossCheck[];
  normalizedForecastSha256?: string;
};

type GitHubCommit = {
  sha?: string;
  commit?: {
    committer?: {
      date?: string | null;
    };
  };
};

type FileSnapshot = {
  path: string;
  contents: string;
};

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function latestPublication(polls: PollObservation[]): string {
  const latest = polls.flatMap((poll) => poll.publishedAt ? [poll.publishedAt] : []).sort().at(-1);
  if (!latest) throw new Error("The downloaded poll bank has no dated observations");
  return latest;
}

function assertIsoDate(value: string, label: string): void {
  if (!isIsoDateStamp(value)) {
    throw new Error(`${label} is not a valid ISO date: ${value}`);
  }
}

function assertIsoTimestamp(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} is not a valid timestamp: ${value}`);
}

function assertPrimaryCrossChecks(polls: PollObservation[], crossChecks: PrimaryCrossCheck[]): void {
  const aliases: Record<string, string[]> = {
    Novus: ["Novus"],
    "SVT/Verian": ["Sifo", "Verian"],
    SCB: ["SCB"],
  };

  for (const crossCheck of crossChecks) {
    const poll = polls.find((observation) => (
      observation.publishedAt === crossCheck.publishedAt
      && (aliases[crossCheck.publisher] ?? [crossCheck.publisher]).includes(observation.company)
    ));
    if (!poll) throw new Error(`Primary cross-check ${crossCheck.publisher} ${crossCheck.publishedAt} is missing`);

    for (const [key, expected] of Object.entries(crossCheck.expected)) {
      const actual = key === "n" ? poll.sampleSize : poll.shares[key as keyof typeof poll.shares];
      if (actual !== expected) {
        throw new Error(`Primary cross-check ${crossCheck.publisher} ${key}: expected ${expected}, received ${actual ?? "missing"}`);
      }
    }
  }
}

function requestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Into-The-Politicalverse-data-refresh",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Upstream request failed with ${response.status} for ${url}`);
  return response.text();
}

async function fetchLatestCommit(): Promise<{ sha: string; committedAt: string }> {
  const response = await fetch(UPSTREAM_COMMITS_URL, {
    headers: requestHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GitHub commit lookup failed with ${response.status}`);
  const commits = await response.json() as GitHubCommit[];
  const sha = commits[0]?.sha;
  const committedAt = commits[0]?.commit?.committer?.date ?? undefined;
  if (!sha || !/^[a-f0-9]{40}$/.test(sha)) throw new Error("GitHub did not return a valid immutable source commit");
  if (!committedAt) throw new Error("GitHub did not return the source commit timestamp");
  assertIsoTimestamp(committedAt, "Upstream commit date");
  return { sha, committedAt };
}

async function atomicWrite(path: string, contents: string): Promise<void> {
  const temporaryPath = `${path}.incoming-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, contents, "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function replaceValidatedDataset(
  snapshots: FileSnapshot[],
  replacements: FileSnapshot[],
): Promise<void> {
  try {
    for (const replacement of replacements) await atomicWrite(replacement.path, replacement.contents);
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const snapshot of snapshots) {
      try {
        await atomicWrite(snapshot.path, snapshot.contents);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError([error, ...rollbackErrors], "Poll refresh failed and the last-known-good snapshot could not be fully restored");
    }
    throw error;
  }
}

const [currentRaw, currentManifestContents, currentForecast, historyContents] = await Promise.all([
  readFile(RAW_PATH, "utf8"),
  readFile(MANIFEST_PATH, "utf8"),
  readFile(FORECAST_PATH, "utf8"),
  readFile(HISTORY_PATH, "utf8"),
]);
const currentManifest = JSON.parse(currentManifestContents) as PollManifest;
if (currentManifest.schemaVersion !== 1 || currentManifest.classification !== "POLL") {
  throw new Error("Unsupported local polling manifest; refusing to replace the last-known-good snapshot");
}
if (currentManifest.repositoryUrl !== UPSTREAM_REPOSITORY_URL || currentManifest.rawUrl !== UPSTREAM_MASTER_RAW_URL) {
  throw new Error("The polling manifest no longer points to the pinned SwedishPolls source");
}
if (sha256(currentRaw) !== currentManifest.rawSha256) {
  throw new Error("The local raw poll snapshot does not match its manifest; refusing an automated refresh");
}
if (!currentManifest.normalizedForecastSha256 || sha256(currentForecast) !== currentManifest.normalizedForecastSha256) {
  throw new Error("The local normalized forecast does not match its manifest; refusing an automated refresh");
}

const stockholmToday = dateInTimeZone(new Date(), "Europe/Stockholm");
if (stockholmToday > FORECAST_ELECTION_DATE) {
  console.log(`Election day ${FORECAST_ELECTION_DATE} has passed; the last pre-election forecast is retained.`);
  process.exit(0);
}

const upstream = await fetchLatestCommit();
const pinnedRawUrl = `https://raw.githubusercontent.com/MansMeg/SwedishPolls/${upstream.sha}/${UPSTREAM_FILE_PATH}`;
const [candidateRaw, currentMasterRaw] = await Promise.all([
  fetchText(pinnedRawUrl),
  fetchText(UPSTREAM_MASTER_RAW_URL),
]);
if (candidateRaw !== currentMasterRaw) {
  throw new Error("SwedishPolls master moved during refresh; quarantining this run for a clean retry");
}

const candidateRawSha256 = sha256(candidateRaw);
if (upstream.sha === currentManifest.sourceCommit && candidateRawSha256 !== currentManifest.rawSha256) {
  throw new Error("The immutable upstream commit no longer matches the accepted checksum");
}

const polls = parsePollCsv(candidateRaw);
const candidateLatestPublication = latestPublication(polls);
if (candidateLatestPublication > stockholmToday) {
  throw new Error(`Latest poll publication ${candidateLatestPublication} is after today's Swedish calendar date ${stockholmToday}`);
}
if (candidateLatestPublication > FORECAST_ELECTION_DATE) {
  throw new Error(`Latest poll publication ${candidateLatestPublication} is after election day ${FORECAST_ELECTION_DATE}`);
}
validateForecastInputs(polls, candidateLatestPublication);
assertPrimaryCrossChecks(polls, currentManifest.primaryCrossChecks);
if (polls.length < currentManifest.expectedRows) {
  throw new Error(`Poll bank shrank from ${currentManifest.expectedRows} to ${polls.length} rows`);
}
assertIsoDate(currentManifest.latestPollPublication, "Accepted latest publication");
if (candidateLatestPublication < currentManifest.latestPollPublication) {
  throw new Error(`Latest publication regressed from ${currentManifest.latestPollPublication} to ${candidateLatestPublication}`);
}
const latestRows = polls.filter((poll) => poll.publishedAt === candidateLatestPublication);
if (!latestRows.some(hasCompleteModernShares)) {
  throw new Error(`Latest publication ${candidateLatestPublication} has no complete eight-party observation`);
}
assertIsoTimestamp(currentManifest.sourceCommitDate, "Accepted source commit date");
if (Date.parse(upstream.committedAt) < Date.parse(currentManifest.sourceCommitDate)) {
  throw new Error(`Source commit timestamp regressed from ${currentManifest.sourceCommitDate} to ${upstream.committedAt}`);
}

const acceptedSource = JSON.parse(currentForecast).source;
if (candidateRawSha256 === currentManifest.rawSha256 && upstream.sha === currentManifest.sourceCommit
  && acceptedSource.adapterVersion === POLLS_ADAPTER_VERSION
  && JSON.stringify(acceptedSource.publicationDateCorrections) === JSON.stringify(PUBLICATION_DATE_CORRECTIONS)) {
  console.log(`SwedishPolls is unchanged at ${upstream.sha.slice(0, 12)}; last-known-good forecast retained.`);
  process.exit(0);
}

const snapshotCreatedAt = new Date().toISOString();
const candidateManifest: PollManifest = {
  ...currentManifest,
  sourceCommit: upstream.sha,
  sourceCommitDate: upstream.committedAt,
  retrievedAt: snapshotCreatedAt.slice(0, 10),
  snapshotCreatedAt,
  rawSha256: candidateRawSha256,
  expectedRows: polls.length,
  latestPollPublication: candidateLatestPublication,
};
const history = JSON.parse(historyContents) as NationalHistoryData;
const forecast = generateElectionForecast({
  polls,
  history: history.elections,
  dataCutoff: candidateLatestPublication,
  generatedAt: snapshotCreatedAt,
  source: {
    dataset: "SwedishPolls",
    classification: "POLL",
    repositoryUrl: candidateManifest.repositoryUrl,
    rawUrl: candidateManifest.rawUrl,
    upstreamCommit: candidateManifest.sourceCommit,
    rawSha256: candidateManifest.rawSha256,
    license: candidateManifest.license,
    retrievedAt: candidateManifest.retrievedAt,
    adapterVersion: POLLS_ADAPTER_VERSION,
    publicationDateCorrections: PUBLICATION_DATE_CORRECTIONS,
    primaryCrossChecks: candidateManifest.primaryCrossChecks.map(({ publisher, publishedAt, url }) => ({
      publisher,
      publishedAt,
      url,
      validated: true,
    })),
  },
});
const forecastContents = `${JSON.stringify(forecast, null, 2)}\n`;
candidateManifest.normalizedForecastSha256 = sha256(forecastContents);
const candidateManifestContents = `${JSON.stringify(candidateManifest, null, 2)}\n`;

await replaceValidatedDataset(
  [
    { path: RAW_PATH, contents: currentRaw },
    { path: MANIFEST_PATH, contents: currentManifestContents },
    { path: FORECAST_PATH, contents: currentForecast },
  ],
  [
    { path: RAW_PATH, contents: candidateRaw },
    { path: MANIFEST_PATH, contents: candidateManifestContents },
    { path: FORECAST_PATH, contents: forecastContents },
  ],
);

console.log(
  `Accepted ${polls.length} SwedishPolls rows at ${upstream.sha.slice(0, 12)}; generated ${forecast.model.simulations.toLocaleString("en-US")} simulations through ${candidateLatestPublication}.`,
);
