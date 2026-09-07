import assert from "node:assert/strict";
import test from "node:test";
import { advanceScrollHeader, createScrollHeaderState, type ScrollHeaderState } from "../lib/ui/scroll-header";

const bounds = { headerHeight: 110, maxScroll: 2000 };
const top = (state: ScrollHeaderState, y: number) => state.phase === "floating" ? 0 : (state.documentY ?? 0) - y;

test("the first downward scroll leaves the header in normal document flow", () => {
  let state = createScrollHeaderState(0);
  for (const y of [15, 50, 105, 110, 115, 120, 130, 500, 1700]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.phase, "flow");
  }
});

test("jitter cannot start an upward reveal", () => {
  let state = createScrollHeaderState(800);
  for (const y of [799, 801, 797, 803, 800, 797, 801, 796]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.phase, "flow");
  }
  const revealing = advanceScrollHeader(state, 795, bounds);
  assert.equal(revealing.phase, "tracking");
  assert.equal(top(revealing, 795), -110);
});

test("slow fractional upward movement accumulates from the last peak", () => {
  let state = createScrollHeaderState(500);
  for (let i = 1; i < 32; i++) {
    state = advanceScrollHeader(state, 500 - i / 4, bounds);
    assert.equal(state.phase, "flow");
  }
  assert.equal(advanceScrollHeader(state, 492, bounds).phase, "tracking");
});

test("reveal follows the gesture one-for-one and pins only at the top edge", () => {
  let state = advanceScrollHeader(createScrollHeaderState(800), 792, bounds);
  for (const y of [782, 770, 752, 700, 683]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.phase, "tracking");
    assert.equal(top(state, y), -110 + 792 - y);
  }
  state = advanceScrollHeader(state, 682, bounds);
  assert.equal(state.phase, "floating");
  assert.equal(top(state, 682), 0);
});

test("stopping and reversing a partial reveal preserves its document position", () => {
  let state = advanceScrollHeader(createScrollHeaderState(800), 792, bounds);
  state = advanceScrollHeader(state, 742, bounds);
  const documentY = state.documentY;
  assert.equal(advanceScrollHeader(state, 742, bounds), state);
  for (const y of [750, 760, 745, 730, 780]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.documentY, documentY);
    assert.equal(top(state, y), 682 - y);
  }
  assert.equal(advanceScrollHeader(state, 792, bounds).phase, "flow");
});

test("downward release never jumps to catch up with batched scroll events", () => {
  for (const y of [508, 524, 534, 1200]) {
    const state = advanceScrollHeader(createScrollHeaderState(500, true), y, bounds);
    assert.equal(state.phase, "tracking");
    assert.equal(top(state, y), 0);
    assert.equal(advanceScrollHeader(state, y, bounds), state);
    const moved = advanceScrollHeader(state, y + 20, bounds);
    assert.equal(top(moved, y + 20), -20);
  }
});

test("a small correction keeps a fully revealed header pinned", () => {
  let state = createScrollHeaderState(600, true);
  for (const y of [605, 600, 607, 604, 595, 602]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.phase, "floating");
  }
  assert.equal(advanceScrollHeader(state, 603, bounds).phase, "tracking");
});

test("a paused gesture at either edge cannot repeatedly detach or pin", () => {
  const revealing = advanceScrollHeader(createScrollHeaderState(800), 792, bounds);
  const releasing = advanceScrollHeader(createScrollHeaderState(800, true), 808, bounds);
  for (let i = 0; i < 10; i++) {
    assert.equal(advanceScrollHeader(revealing, 792, bounds), revealing);
    assert.equal(advanceScrollHeader(releasing, 808, bounds), releasing);
  }
});

test("five complete down/up/down cycles preserve native movement", () => {
  let state = createScrollHeaderState(300);
  for (const peak of [500, 800, 1100, 1400, 1700]) {
    state = advanceScrollHeader(state, peak, bounds);
    state = advanceScrollHeader(state, peak - 8, bounds);
    state = advanceScrollHeader(state, peak - 118, bounds);
    assert.equal(state.phase, "floating");
    state = advanceScrollHeader(state, peak - 110, bounds);
    assert.equal(top(state, peak - 110), 0);
    state = advanceScrollHeader(state, peak, bounds);
    assert.equal(state.phase, "flow");
  }
});

test("Safari rubber-band samples cannot create a false reveal", () => {
  let state = createScrollHeaderState(1999);
  for (const y of [2000, 2010, 2070, 2025, 2001, 2000, 1997]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.phase, "flow");
  }
  assert.equal(advanceScrollHeader(state, 1992, bounds).phase, "tracking");
  for (const y of [-1, -45, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(advanceScrollHeader(state, y, bounds), state);
  }
});

test("menu and keyboard access reveal immediately at every scroll position", () => {
  const state = advanceScrollHeader(createScrollHeaderState(800), 792, bounds);
  for (const y of [0, 750, 1200, 2030]) {
    assert.equal(advanceScrollHeader(state, y, { ...bounds, pinned: true }).phase, "floating");
  }
});

test("resize can retire a tracking surface that no longer reaches the viewport", () => {
  const state = advanceScrollHeader(createScrollHeaderState(800), 792, bounds);
  const resized = advanceScrollHeader(state, 760, { headerHeight: 60, maxScroll: 1800 });
  assert.equal(resized.phase, "flow");
});

test("a pinned header stays in place until the actual page top", () => {
  let state = createScrollHeaderState(500, true);
  for (const y of [300, 150, 109, 50, 1]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.phase, "floating");
  }
  assert.equal(advanceScrollHeader(state, 0, bounds).phase, "flow");
});

test("the original header stays in normal flow while still visible", () => {
  let state = createScrollHeaderState(80);
  for (const y of [70, 50, 40, 20, 0]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.phase, "flow");
  }
});
