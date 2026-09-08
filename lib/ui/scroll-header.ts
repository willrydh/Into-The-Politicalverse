export interface ScrollHeaderState {
  y: number;
  hidden: boolean;
}

export function createScrollHeaderState(y: number): ScrollHeaderState {
  return { y: Number.isFinite(y) ? Math.max(0, y) : 0, hidden: false };
}

/** Direction selects the endpoint; CSS owns the whole reversible slide. */
export function advanceScrollHeader(
  state: ScrollHeaderState,
  y: number,
  { maxScroll, pinned = false }: { maxScroll: number; pinned?: boolean },
): ScrollHeaderState {
  if (!Number.isFinite(y) || y < 0 || y > maxScroll) return state;
  if (pinned || y === 0) return createScrollHeaderState(y);
  if (y === state.y) return state;
  return { y, hidden: y > state.y };
}
