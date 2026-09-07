import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { download, INDEX_URLS, indexEntry, readSignedArchive } from "../lib/live/official-files";
import { assertResultAdvance } from "../lib/live/result-adapter";
import { stageRiksdag2026 } from "../lib/live/stage-2026";
import type { FeedMode } from "../lib/live/types";

const root = resolve(import.meta.dirname, "..");
const mode: FeedMode = process.argv.includes("--rehearsal") ? "rehearsal" : "production";
const now = new Date().toISOString(), stage = "final-count" as const;
const index = await download(INDEX_URLS[mode], 256 * 1024, mode === "production");
const entry = index ? indexEntry(index.toString("utf8"), mode, stage) : null;
if (!entry) {
  console.log("No final-count archive has been published for this intake. Existing data is unchanged.");
  process.exit(0);
}
const certificate = await readFile(resolve(root, "data/raw/valmyndigheten-2026/val-sign-crt.pem"));
const archive = await download(entry.url, 64 * 1024 * 1024);
if (!archive) throw new Error("Final-count archive unavailable");
const signed = await readSignedArchive(archive, entry, { mode, stage, now, certificate });
const staged = stageRiksdag2026(signed.raw, { mode, stage, now, source: signed.source });
const output = resolve(root, mode === "production" ? "data/staging/2026/riksdag.json" : "data/rehearsal/2026-staged-riksdag.json");
try {
  const previous = JSON.parse(await readFile(output, "utf8"));
  if (previous.classification !== staged.classification) throw new Error("Staging classification changed");
  assertResultAdvance(previous.result, staged.result);
} catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.incoming-${process.pid}`;
await writeFile(temporary, `${JSON.stringify(staged, null, 2)}\n`);
await rename(temporary, output);
console.log(JSON.stringify({ mode, publication: staged.publication, constituencies: staged.personalVotes.length, candidates: staged.personalVotes.reduce((sum, a) => sum + a.parties.reduce((sum, p) => sum + (p.candidates?.length ?? 0), 0), 0), output }));
