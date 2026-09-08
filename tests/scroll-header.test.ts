import assert from "node:assert/strict";
import test from "node:test";
import { advanceScrollHeader, createScrollHeaderState } from "../lib/ui/scroll-header";

const bounds = { maxScroll: 2000 };

test("down hides and up reveals, including fractional movement", () => {
  let state = createScrollHeaderState(500);
  for (const delta of [0.25, 0.25, -0.25, -0.25, 2, -2, 10, -10]) {
    state = advanceScrollHeader(state, state.y + delta, bounds);
    assert.equal(state.hidden, delta > 0);
  }
});

test("pausing preserves the current transition target", () => {
  const state = advanceScrollHeader(createScrollHeaderState(100), 101, bounds);
  assert.equal(advanceScrollHeader(state, 101, bounds), state);
});

test("rubber-band overscroll cannot reverse the menu", () => {
  let state = advanceScrollHeader(createScrollHeaderState(1999), 2000, bounds);
  for (const y of [2010, 2080, 2020, 2001, -1, -40, NaN, Infinity]) {
    assert.equal(advanceScrollHeader(state, y, bounds), state);
  }
  state = advanceScrollHeader(state, 1999, bounds);
  assert.equal(state.hidden, false);
});

test("menu/keyboard pinning and reaching page top always show the menu", () => {
  const hidden = advanceScrollHeader(createScrollHeaderState(500), 510, bounds);
  assert.equal(advanceScrollHeader(hidden, 520, { ...bounds, pinned: true }).hidden, false);
  assert.deepEqual(advanceScrollHeader(hidden, 0, bounds), createScrollHeaderState(0));
});

test("restored pages begin with accessible navigation", () => {
  for (const y of [0, 100, 1000, NaN, -1]) assert.equal(createScrollHeaderState(y).hidden, false);
});
