import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { validatePublicFeed } from "../lib/live/public-feed";
import { publicNowcast } from "../lib/nowcast/public";
import { evaluateNowcastOutcome } from "../lib/nowcast/audit";

// Read the already published branch. Never reconstruct a past prediction from
// newer district data or write to the live-data branch during evaluation.
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
if (process.argv.includes("--fetch")) git("fetch", "origin", "live-data");
const ref = "origin/live-data";
const head = git("rev-parse", ref).trim();
assert.match(head, /^[a-f0-9]{40}$/);
const latest = validatePublicFeed(
  JSON.parse(git("show", `${head}:election-2026.json`)),
);
const final =
  latest.stageStatus["final-count"] === "ok"
    ? latest.results["final-count"]
    : null;
const commits = git(
  "log",
  "--max-count=10001",
  "--format=%H %cI",
  ref,
  "--",
  "election-2026.json",
)
  .trim()
  .split("\n");
assert.ok(
  commits.length <= 10000,
  "Audit limit exceeded; do not silently truncate election history",
);
const seen = new Set<string>(),
  snapshots = [];
for (const line of commits.reverse()) {
  const [commit, committedAt] = line.split(" ");
  assert.match(commit, /^[a-f0-9]{40}$/);
  const feed = validatePublicFeed(
    JSON.parse(git("show", `${commit}:election-2026.json`)),
  );
  const e = publicNowcast(feed);
  if (e?.status !== "experimental") continue;
  const s = feed.nowcast!.source!;
  const key = [
    e.methodVersion,
    e.probability?.methodVersion,
    s.jsonSha256,
    s.baselineSha256,
  ].join(":");
  if (seen.has(key)) continue;
  assert.ok(
    Date.parse(feed.checkedAt) <= Date.parse(committedAt) + 60000,
    "Prediction clock is later than its archive commit",
  );
  seen.add(key);
  snapshots.push({
    commit,
    committedAt,
    checkedAt: feed.checkedAt,
    methodVersion: e.methodVersion,
    source: s,
    matchedCoverage: e.matchedCoverage,
    countedVotes: e.countedVotes,
    projected: e.rows,
    probability: e.probability ?? null,
    evaluation: final ? evaluateNowcastOutcome(e, committedAt, final) : null,
  });
}
const output =
  process.argv.find((v) => v.startsWith("--output="))?.slice(9) ??
  "/tmp/politicalverse-nowcast-audit-2026.json";
const report = {
  archiveHead: head,
  status:
    final && final.national.countedDistricts === final.national.totalDistricts
      ? "complete-count-comparison"
      : "awaiting-complete-final-count",
  finalSource: final?.source ?? null,
  scope:
    "First archived publication of each validated current-model/source/baseline identity. Commit times are repository audit evidence, not independent third-party timestamp certification. Incompatible older model versions are excluded. No partial count is graded as final.",
  snapshots,
};
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    output,
    status: report.status,
    archivedPredictions: snapshots.length,
    graded: snapshots.filter((s) => s.evaluation).length,
  }),
);
