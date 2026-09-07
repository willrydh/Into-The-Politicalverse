import assert from "node:assert/strict";
import test from "node:test";
import { advanceScrollHeader, createScrollHeaderState, releasedHeaderY } from "../lib/ui/scroll-header";

const bounds = { headerHeight: 110, maxScroll: 2000 };

test("the first downward scroll leaves the header in normal document flow", () => {
  let state = createScrollHeaderState(0);
  for (const y of [15, 50, 105, 110, 115, 120, 130, 500, 1700]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.floating, false);
  }
});

test("an off-screen header rejects jitter and returns after a deliberate upward gesture", () => {
  let state = createScrollHeaderState(800);
  for (const y of [799, 801, 797, 803, 800, 797, 801, 796]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.floating, false);
  }
  assert.equal(advanceScrollHeader(state, 795, bounds).floating, true);
});

test("slow fractional upward scrolling accumulates from the last peak", () => {
  let state = createScrollHeaderState(500);
  for (let i = 1; i < 32; i++) {
    state = advanceScrollHeader(state, 500 - i / 4, bounds);
    assert.equal(state.floating, false);
  }
  assert.equal(advanceScrollHeader(state, 492, bounds).floating, true);
});

test("a returned header ignores a small correction before releasing to native scrolling", () => {
  let state = advanceScrollHeader(createScrollHeaderState(600), 592, bounds);
  for (const y of [595, 598, 590, 602, 600, 590, 613]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.floating, true);
  }
  assert.equal(advanceScrollHeader(state, 614, bounds).floating, false);
});

test("Safari bottom bounce cannot turn into a false upward reveal", () => {
  let state = createScrollHeaderState(1999);
  for (const y of [2000, 2010, 2070, 2025, 2001, 2000, 1997]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.floating, false);
  }
  assert.equal(advanceScrollHeader(state, 1992, bounds).floating, true);
});

test("invalid positions do not move the header and the page top restores normal flow", () => {
  const state = createScrollHeaderState(500, true);
  for (const y of [-1, -45, -0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(advanceScrollHeader(state, y, bounds), state);
  }
  assert.equal(advanceScrollHeader(state, 0, bounds).floating, false);
});

test("open navigation and keyboard focus keep the header available, even at the top", () => {
  const state = createScrollHeaderState(800);
  for (const y of [0, 1200, 2030]) {
    assert.equal(advanceScrollHeader(state, y, { ...bounds, pinned: true }).floating, true);
  }
});

test("viewport remeasurement preserves floating state and resets gesture distance", () => {
  const resized = createScrollHeaderState(850, true);
  assert.equal(advanceScrollHeader(resized, 850, bounds).floating, true);
  assert.equal(advanceScrollHeader(resized, 873, bounds).floating, true);
  assert.equal(advanceScrollHeader(resized, 874, bounds).floating, false);
});

test("a revealed header does not jump back into the document near the page top", () => {
  let state = createScrollHeaderState(500, true);
  for (const y of [300, 150, 109, 50, 1]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.floating, true);
  }
  assert.equal(advanceScrollHeader(state, 0, bounds).floating, false);
});

test("a small reversal while the original header is visible does not detach it", () => {
  let state = createScrollHeaderState(80);
  for (const y of [70, 50, 40, 20, 0]) {
    state = advanceScrollHeader(state, y, bounds);
    assert.equal(state.floating, false);
  }
});

test("a large downward event scrolls a previously floating header completely off screen", () => {
  const documentY = releasedHeaderY(1200, 500, 0);
  assert.ok(documentY + bounds.headerHeight < 1200);
  // Extra movement cannot delay the release until the final event's position.
  assert.equal(documentY, releasedHeaderY(524, 500, 0));
});

test("releasing during entry preserves its current offset and then follows native scroll", () => {
  const documentY = releasedHeaderY(524, 500, -50);
  assert.equal(documentY - 524, -50);
  assert.equal(documentY - 550, -76);
  assert.equal(releasedHeaderY(534, 500, -50) - 534, -60);
});
