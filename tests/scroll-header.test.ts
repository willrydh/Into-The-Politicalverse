import assert from "node:assert/strict";
import test from "node:test";
import { advanceScrollHeader, createScrollHeaderState } from "../lib/ui/scroll-header";

const bounds = { headerHeight: 110, maxScroll: 2000 };

test("header stays available near the top and hides after a deliberate downward movement", () => {
  let state = createScrollHeaderState(0);
  for (const y of [15, 50, 105, 110, 115, 120, 130]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.hidden, false);
  }
  assert.equal(advanceScrollHeader(state, 134, bounds).hidden, true);
  assert.equal(advanceScrollHeader(createScrollHeaderState(0), 500, bounds).hidden, true);
});

test("a hidden header rejects oscillating scroll jitter but responds to an upward gesture", () => {
  let state = createScrollHeaderState(800, true);
  for (const y of [799, 801, 797, 803, 800, 797, 801, 796]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.hidden, true);
  }
  assert.equal(advanceScrollHeader(state, 795, bounds).hidden, false);
});

test("slow fractional upward scrolling accumulates from the last peak", () => {
  let state = createScrollHeaderState(500, true);
  for (let i = 1; i < 32; i++) {
    state = advanceScrollHeader(state, 500 - i / 4, bounds);
    assert.equal(state.hidden, true);
  }
  assert.equal(advanceScrollHeader(state, 492, bounds).hidden, false);
});

test("a newly revealed header does not immediately reverse on a small downward correction", () => {
  let state = advanceScrollHeader(createScrollHeaderState(600, true), 592, bounds);
  for (const y of [595, 598, 590, 602, 600, 590, 613]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.hidden, false);
  }
  assert.equal(advanceScrollHeader(state, 614, bounds).hidden, true);
});

test("Safari bottom bounce cannot turn into a false upward reveal", () => {
  let state = createScrollHeaderState(1999, true);
  for (const y of [2000, 2010, 2070, 2025, 2001, 2000, 1997]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.hidden, true);
  }
  assert.equal(advanceScrollHeader(state, 1992, bounds).hidden, false);
});

test("top rubber-band samples are ignored and returning to the top reveals the header", () => {
  const state = createScrollHeaderState(500, true);
  for (const y of [-1, -45, -0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(advanceScrollHeader(state, y, bounds), state);
  }
  assert.equal(advanceScrollHeader(state, 0, bounds).hidden, false);
});

test("an open menu or keyboard focus pins the header through scrolling", () => {
  const state = createScrollHeaderState(800, true);
  assert.equal(advanceScrollHeader(state, 1200, { ...bounds, pinned: true }).hidden, false);
});

test("viewport remeasurement preserves visibility and resets gesture distance", () => {
  const state = createScrollHeaderState(1000, true);
  const resized = createScrollHeaderState(850, state.hidden);
  assert.equal(advanceScrollHeader(resized, 850, bounds).hidden, true);
  assert.equal(advanceScrollHeader(resized, 844, bounds).hidden, true);
  assert.equal(advanceScrollHeader(resized, 842, bounds).hidden, false);
});
