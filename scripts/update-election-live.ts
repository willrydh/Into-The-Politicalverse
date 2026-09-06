import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { collectLiveData, emptyFeed } from "../lib/live/collector";
import type { FeedMode, LiveFeed } from "../lib/live/types";

const root = resolve(import.meta.dirname, "..");
const mode: FeedMode = process.argv.includes("--rehearsal") ? "rehearsal" : "production";
const outIndex = process.argv.indexOf("--output");
if (mode === "rehearsal" && outIndex >= 0) throw new Error("Rehearsal output cannot be redirected into production");
const output = outIndex >= 0 ? resolve(process.argv[outIndex + 1]) : resolve(root, mode === "production" ? "data/live/election-2026.json" : "data/rehearsal/election-2026.json");
if (basename(output) !== "election-2026.json") throw new Error("Unexpected live-feed filename");
const now = new Date().toISOString();
let previous: LiveFeed;
try { previous = JSON.parse(await readFile(output, "utf8")); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; previous = emptyFeed(mode, now); }
const certificate = await readFile(resolve(root, "data/raw/valmyndigheten-2026/val-sign-crt.pem"));
const { feed, errors } = await collectLiveData(previous, { mode, now, certificate });
await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.incoming-${randomUUID()}`;
await writeFile(temporary, `${JSON.stringify(feed, null, 2)}\n`);
await rename(temporary, output);
console.log(JSON.stringify({ mode, resultStatus: feed.resultStatus, checkedAt: now, earlyVoting: feed.earlyVoting?.receivedVotes, stages: feed.stageStatus, output, errors }));
// The status and retained good snapshots are still published before the job reports a failure.
if (errors.length) process.exitCode = 1;
