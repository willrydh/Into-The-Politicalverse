export interface ScrollHeaderState {
  phase: "flow" | "tracking" | "floating";
  anchorY: number;
  documentY: number | null;
}

const DIRECTION_DISTANCE = 8;

export function createScrollHeaderState(y: number, floating = false): ScrollHeaderState {
  return { phase: floating ? "floating" : "flow", anchorY: Number.isFinite(y) ? Math.max(0, y) : 0, documentY: null };
}

/** A native document movement in both directions, pinned only once fully shown. */
export function advanceScrollHeader(
  state: ScrollHeaderState,
  y: number,
  { headerHeight, maxScroll, pinned = false }: { headerHeight: number; maxScroll: number; pinned?: boolean },
): ScrollHeaderState {
  if (pinned) return createScrollHeaderState(y, true);
  // Ignore Safari's rubber-band samples, including the rebound from either end.
  if (!Number.isFinite(y) || y < 0 || y > maxScroll) return state;
  if (y === 0) return createScrollHeaderState(y);
  if (state.phase === "tracking") {
    const documentY = state.documentY!;
    if (y < documentY || (y === documentY && y < state.anchorY)) return createScrollHeaderState(y, true);
    if (y > documentY + headerHeight || (y === documentY + headerHeight && y > state.anchorY)) return createScrollHeaderState(y);
    // No position writes while moving: the document owns both directions.
    return y === state.anchorY ? state : { ...state, anchorY: y };
  }
  // The original header is still in view here; let the browser scroll it.
  if (state.phase === "flow" && y <= headerHeight) return createScrollHeaderState(y);

  const floating = state.phase === "floating";
  const anchorY = floating ? Math.min(state.anchorY, y) : Math.max(state.anchorY, y);
  const distance = floating ? y - anchorY : anchorY - y;
  if (distance >= DIRECTION_DISTANCE) {
    // Begin at the painted edge, never catch up with past/batched scroll deltas.
    return { phase: "tracking", anchorY: y, documentY: floating ? y : y - headerHeight };
  }
  return anchorY === state.anchorY ? state : { ...state, anchorY };
}
