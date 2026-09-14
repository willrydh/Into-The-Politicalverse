import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { collectLiveData, emptyFeed } from "../lib/live/collector";
import type { FeedMode, LiveFeed } from "../lib/live/types";
import { collectAreaResults, emptyAreaFeed } from "../lib/live/area-collector";
import type { AreaFeed } from "../lib/live/area-types";

const root = resolve(import.meta.dirname, "..");
const mode: FeedMode = process.argv.includes("--rehearsal")
  ? "rehearsal"
  : "production";
const outIndex = process.argv.indexOf("--output");
if (mode === "rehearsal" && outIndex >= 0)
  throw new Error("Rehearsal output cannot be redirected into production");
const output =
  outIndex >= 0
    ? resolve(process.argv[outIndex + 1])
    : resolve(
        root,
        mode === "production"
          ? "data/live/election-2026.json"
          : "data/rehearsal/election-2026.json",
      );
if (basename(output) !== "election-2026.json")
  throw new Error("Unexpected live-feed filename");
const now = new Date().toISOString();
let previous: LiveFeed;
try {
  previous = JSON.parse(await readFile(output, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  previous = emptyFeed(mode, now);
}
const certificate = await readFile(
  resolve(root, "data/raw/valmyndigheten-2026/val-sign-crt.pem"),
);
// Load the optional model behind a failure boundary: official collection must
// also work if its baseline or module cannot be initialized.
let model: typeof import("../lib/nowcast/pipeline") | null = null;
let baselineSha256: string | undefined;
let modelLoadError: unknown;
try {
  model = await import("../lib/nowcast/pipeline");
  baselineSha256 = (await import("../lib/nowcast/baseline")).baselineSha256;
} catch (error) {
  modelLoadError = error;
}
const { feed, errors, nowcastWarnings } = await collectLiveData(previous, {
  mode,
  now,
  certificate,
  nowcastBaselineSha: baselineSha256,
  nowcast: async (archive, entry, result, old) => {
    if (!model) throw modelLoadError ?? new Error("Model unavailable");
    return model.deriveNowcast(
      archive,
      entry,
      result,
      { mode, now, certificate },
      old,
    );
  },
});
await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.incoming-${randomUUID()}`;
await writeFile(temporary, `${JSON.stringify(feed, null, 2)}\n`);
await rename(temporary, output);
// A separate, larger feed is requested only by local-result views. Its failures
// cannot discard the already-written national count or model generation.
let areaErrors: string[] = [];
if (mode === "production") {
  const areaOutput = resolve(dirname(output), "area-results-2026.json");
  let previousAreas: AreaFeed;
  try { previousAreas = JSON.parse(await readFile(areaOutput, "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    previousAreas = emptyAreaFeed(now);
  }
  const collected = await collectAreaResults(previousAreas, { now, certificate });
  areaErrors = collected.errors;
  const areaTemporary = `${areaOutput}.incoming-${randomUUID()}`;
  await writeFile(areaTemporary, `${JSON.stringify(collected.feed)}\n`);
  await rename(areaTemporary, areaOutput);
  console.log(JSON.stringify({ areaOutput, published: collected.feed.published, verifiedAreas: Object.keys(collected.feed.results).length, areaErrors }));
}
console.log(
  JSON.stringify({
    mode,
    resultStatus: feed.resultStatus,
    checkedAt: now,
    earlyVoting: feed.earlyVoting?.receivedVotes,
    stages: feed.stageStatus,
    nowcast: feed.nowcast?.status,
    nowcastWarnings,
    output,
    errors,
  }),
);
if (nowcastWarnings.length)
  console.warn(`::warning::Nowcast unavailable: ${nowcastWarnings.join("; ")}`);
// The status and retained good snapshots are still published before the job reports a failure.
if (errors.length || areaErrors.length) process.exitCode = 1;
