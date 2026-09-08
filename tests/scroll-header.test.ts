import assert from "node:assert/strict";
import test from "node:test";
import { advanceScrollHeader, createScrollHeaderState, type ScrollHeaderState } from "../lib/ui/scroll-header";

const bounds = { headerHeight: 110, maxScroll: 2000 };
const top = (state: ScrollHeaderState) => Math.max(-bounds.headerHeight, Math.min(0, state.documentY - state.y));

test("the initial header scrolls away without changing its document anchor", () => {
  let state = createScrollHeaderState(0);
  for (const y of [0.25, 2, 15, 50, 105, 110, 115, 500, 1700]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.documentY, 0);
    assert.equal(top(state), -Math.min(y, 110));
  }
});

test("slow movement responds to the first fraction of a pixel at both edges", () => {
  const hidden = advanceScrollHeader(createScrollHeaderState(500), 499.75, bounds);
  assert.equal(top(hidden), -109.75);
  const shown = advanceScrollHeader(createScrollHeaderState(500, true), 500.25, bounds);
  assert.equal(top(shown), -0.25);
});

test("pauses and tiny reversals preserve the same anchor through partial movement", () => {
  let state = createScrollHeaderState(500, true);
  for (const y of [502, 504, 506, 508, 510, 508, 506, 504, 502, 500]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.documentY, 500);
    assert.equal(top(state), 500 - y);
    assert.equal(advanceScrollHeader(state, y, bounds), state);
  }
});

test("native bounds stop overshoot without changing anchor at full reveal", () => {
  let state = advanceScrollHeader(createScrollHeaderState(800), 790, bounds);
  assert.equal(state.documentY, 690);
  for (const y of [750, 700, 690, 680, 500]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.documentY, 690);
    assert.equal(top(state), Math.min(0, 690 - y));
  }
  state = advanceScrollHeader(state, 502, bounds);
  assert.equal(top(state), -2);
});

test("repeated slow down/up cycles consume exactly the same distance", () => {
  let state = createScrollHeaderState(500, true);
  for (let cycle = 0; cycle < 5; cycle++) {
    for (let i = 1; i <= 150; i++) {
      state = advanceScrollHeader(state, 500 + i, bounds);
      assert.equal(top(state), -Math.min(i, 110));
    }
    for (let i = 1; i <= 150; i++) {
      state = advanceScrollHeader(state, 650 - i, bounds);
      assert.equal(top(state), Math.min(0, -110 + i));
    }
  }
});

test("mixed movements match a bounded distance accumulator", () => {
  let state = createScrollHeaderState(700, true), expected = 0, seed = 7;
  for (let i = 0; i < 2000; i++) {
    seed = (seed * 16807) % 2147483647;
    const dy = ((seed % 81) - 40) / 4;
    const y = Math.min(1800, Math.max(200, state.y + dy));
    expected = Math.max(-110, Math.min(0, expected - (y - state.y)));
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(top(state), expected);
  }
});

test("Safari rubber-band samples do not reverse or accumulate movement", () => {
  let state = createScrollHeaderState(1999);
  state = advanceScrollHeader(state, 2000, bounds);
  for (const y of [2010, 2070, 2025, 2001, -1, -45, NaN, Infinity]) {
    assert.equal(advanceScrollHeader(state, y, bounds), state);
  }
  state = advanceScrollHeader(state, 1999, bounds);
  assert.equal(top(state), -109);
});

test("menu and keyboard forcing reveals the header; top of document restores its anchor", () => {
  let state = createScrollHeaderState(800);
  state = advanceScrollHeader(state, 800, { ...bounds, pinned: true });
  assert.equal(top(state), 0);
  state = advanceScrollHeader(state, 0, bounds);
  assert.deepEqual(state, createScrollHeaderState(0));
});

test("a smaller header can re-enter from its new hidden edge", () => {
  let state = advanceScrollHeader(createScrollHeaderState(800), 790, bounds);
  state = advanceScrollHeader(state, 789, { ...bounds, headerHeight: 60 });
  assert.equal(state.documentY - state.y, -59);
});
