import assert from "node:assert/strict";
import test from "node:test";
import { daysUntilElection, electionCycleProgress, NEXT_ELECTION_DATE, PREVIOUS_ELECTION_DATE } from "../lib/elections/calendar";

test("2026 countdown clamps at election day", () => {
  assert.equal(daysUntilElection(new Date("2026-09-12T00:00:00+02:00")), 1);
  assert.equal(daysUntilElection(NEXT_ELECTION_DATE), 0);
  assert.equal(daysUntilElection(new Date("2026-09-14T00:00:00+02:00")), 0);
});

test("election-cycle progress is derived from the two official dates", () => {
  const midpoint = new Date((PREVIOUS_ELECTION_DATE.getTime() + NEXT_ELECTION_DATE.getTime()) / 2);
  assert.equal(electionCycleProgress(PREVIOUS_ELECTION_DATE), 0);
  assert.equal(electionCycleProgress(midpoint), 50);
  assert.equal(electionCycleProgress(NEXT_ELECTION_DATE), 100);
});
