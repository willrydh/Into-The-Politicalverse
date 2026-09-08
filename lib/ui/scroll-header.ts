export interface ScrollHeaderState {
  y: number;
  documentY: number;
}

export function createScrollHeaderState(y: number, shown = false): ScrollHeaderState {
  const scrollY = Number.isFinite(y) ? Math.max(0, y) : 0;
  return { y: scrollY, documentY: shown ? scrollY : 0 };
}

/** Re-anchor only when leaving a fully shown/hidden edge. Native sticky owns movement. */
export function advanceScrollHeader(
  state: ScrollHeaderState,
  y: number,
  { headerHeight, maxScroll, pinned = false }: { headerHeight: number; maxScroll: number; pinned?: boolean },
): ScrollHeaderState {
  if (!Number.isFinite(y) || y < 0 || y > maxScroll) return state;
  if (pinned) return createScrollHeaderState(y, true);
  if (y === 0) return createScrollHeaderState(0);
  if (y === state.y) return state;
  let documentY = state.documentY;
  const previousTop = documentY - state.y;
  if (y > state.y && previousTop >= 0) documentY = state.y;
  else if (y < state.y && previousTop <= -headerHeight) documentY = Math.max(0, state.y - headerHeight);
  return { y, documentY };
}
