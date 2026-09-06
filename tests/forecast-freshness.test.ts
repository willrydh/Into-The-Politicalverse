import assert from "node:assert/strict";
import test from "node:test";
import { forecastFreshness } from "../lib/forecast/freshness";

test("freshness ages even when the published snapshot does not change", () => {
  assert.equal(forecastFreshness("2026-09-04", "2026-09-13", "2026-09-06").state, "recent");
  assert.equal(forecastFreshness("2026-09-04", "2026-09-13", "2026-09-11").state, "recent");
  const stale = forecastFreshness("2026-09-04", "2026-09-13", "2026-09-12");
  assert.equal(stale.state, "stale");
  assert.equal(stale.ageDays, 8);
  assert.match(stale.message, /Nyare mätningar kan saknas/);
});

test("after election day a retained forecast is explicitly archived", () => {
  assert.equal(forecastFreshness("2026-09-13", "2026-09-13", "2026-09-13").state, "recent");
  const archived = forecastFreshness("2026-09-13", "2026-09-13", "2026-09-14");
  assert.equal(archived.state, "archived");
  assert.match(archived.message, /Visar inte valresultatet/);
});

test("a future cutoff or invalid date cannot receive a recent label", () => {
  assert.equal(forecastFreshness("2026-09-04", "2026-09-13", "2026-09-03").state, "unknown");
  assert.throws(() => forecastFreshness("2026-02-31", "2026-09-13", "2026-09-06"), /Invalid ISO date/);
});
