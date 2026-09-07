export interface ScrollHeaderState {
  floating: boolean;
  anchorY: number;
}

export const HEADER_RELEASE_DISTANCE = 24;

/** Include movement beyond the threshold when scroll events arrive in batches. */
export function releasedHeaderY(y: number, anchorY: number, paintedTop: number): number {
  return Math.max(0, Math.min(y, anchorY + HEADER_RELEASE_DISTANCE) + paintedTop);
}

export function createScrollHeaderState(y: number, floating = false): ScrollHeaderState {
  return { floating, anchorY: Number.isFinite(y) ? Math.max(0, y) : 0 };
}

/** Normal page flow on the way down; floating navigation only on the way up. */
export function advanceScrollHeader(
  state: ScrollHeaderState,
  y: number,
  { headerHeight, maxScroll, pinned = false }: { headerHeight: number; maxScroll: number; pinned?: boolean },
): ScrollHeaderState {
  if (pinned) return createScrollHeaderState(y, true);
  // Ignore Safari's rubber-band samples, including the rebound from either end.
  if (!Number.isFinite(y) || y < 0 || y > maxScroll) return state;
  if (y === 0) return createScrollHeaderState(y);
  // The original header is still in view here; let the browser scroll it.
  if (!state.floating && y <= headerHeight) return createScrollHeaderState(y);

  const anchorY = state.floating ? Math.min(state.anchorY, y) : Math.max(state.anchorY, y);
  const distance = state.floating ? y - anchorY : anchorY - y;
  if (distance >= (state.floating ? HEADER_RELEASE_DISTANCE : 8)) return createScrollHeaderState(y, !state.floating);
  return anchorY === state.anchorY ? state : { ...state, anchorY };
}
