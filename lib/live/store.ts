import { acceptPublicFeed, LIVE_FEED_URL, LIVE_POLL_INTERVAL_MS } from "./public-feed";
import type { LiveFeed } from "./types";

export type LiveSnapshot = { feed: LiveFeed; connectionError: boolean; clock: number | null };

/** One accepted generation and one request loop for every mounted live view. */
export function createLiveStore(initial: LiveFeed, request: typeof fetch = fetch, now = Date.now) {
  const server: LiveSnapshot = { feed: initial, connectionError: false, clock: null };
  let snapshot = server;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let generation = 0;
  async function refresh() {
    if (controller || !listeners.size) return;
    clearTimeout(timer);
    const run = generation;
    const active = new AbortController();
    controller = active;
    const timeout = setTimeout(() => active.abort(), 12_000);
    try {
      const response = await request(`${LIVE_FEED_URL}?minute=${Math.floor(now() / LIVE_POLL_INTERVAL_MS)}`, { signal: active.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Live feed unavailable");
      const next = acceptPublicFeed(snapshot.feed, await response.json());
      if (run === generation) snapshot = { feed: next, connectionError: false, clock: now() };
    } catch {
      if (run === generation) snapshot = { ...snapshot, connectionError: true, clock: now() };
    } finally {
      clearTimeout(timeout);
      if (run === generation) {
        controller = undefined;
        listeners.forEach(listener => listener());
        if (listeners.size) timer = setTimeout(() => void refresh(), LIVE_POLL_INTERVAL_MS);
      }
    }
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => server,
    refresh,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        // Navigation must not briefly relabel an old snapshot as current.
        snapshot = { ...snapshot, clock: now() };
        void refresh();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          generation++;
          clearTimeout(timer);
          controller?.abort();
          controller = undefined;
        }
      };
    },
  };
}
