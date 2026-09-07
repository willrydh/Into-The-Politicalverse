export interface ScrollHeaderState {
  hidden: boolean;
  anchorY: number;
}

export function createScrollHeaderState(y: number, hidden = false): ScrollHeaderState {
  return { hidden, anchorY: Math.max(0, y) };
}

/** Follow genuine movement from the last peak/trough, not individual scroll events. */
export function advanceScrollHeader(
  state: ScrollHeaderState,
  y: number,
  { headerHeight, maxScroll, pinned = false }: { headerHeight: number; maxScroll: number; pinned?: boolean },
): ScrollHeaderState {
  if (pinned) return createScrollHeaderState(y);
  // Safari reports positions outside the document while rubber-banding. Ignore
  // those samples so the rebound cannot be mistaken for an upward gesture.
  if (!Number.isFinite(y) || y < 0 || y > maxScroll) return state;
  if (y <= headerHeight) return createScrollHeaderState(y);

  const anchorY = state.hidden ? Math.max(state.anchorY, y) : Math.min(state.anchorY, y);
  const distance = state.hidden ? anchorY - y : y - anchorY;
  if (distance >= (state.hidden ? 8 : 24)) return createScrollHeaderState(y, !state.hidden);
  return anchorY === state.anchorY ? state : { ...state, anchorY };
}
