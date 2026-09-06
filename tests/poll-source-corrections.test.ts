import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parsePollCsv, qualifyingPolls } from "../lib/forecast/polls";
import { correctPollPublicationDates } from "../lib/forecast/source-corrections";

test("the September Novus poll is unavailable before its primary-source publication", async () => {
  const raw = await readFile("data/raw/polls/SwedishPolls.csv", "utf8");
  const polls = parsePollCsv(raw);
  const observation = polls.find((poll) => poll.company === "Novus" && poll.fieldworkFrom === "2026-08-24" && poll.fieldworkTo === "2026-08-30");
  assert.ok(observation);
  assert.equal(observation.publishedAt, "2026-09-02");
  assert.equal(qualifyingPolls([observation], "2026-09-01", 180).length, 0);
  assert.equal(qualifyingPolls([observation], "2026-09-02", 180).length, 1);
  assert.deepEqual(correctPollPublicationDates([observation]), [observation], "accept a future upstream date fix without applying it twice");
  assert.throws(() => correctPollPublicationDates([{ ...observation, publishedAt: "2026-09-03" }]), /ambiguous correction/);
});
