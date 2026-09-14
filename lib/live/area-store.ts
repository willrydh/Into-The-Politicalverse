import { AREA_FEED_URL, type AreaFeed } from "./area-types";
import { acceptAreaFeed } from "./public-area-feed";

export function createAreaStore(request: typeof fetch = fetch, now = Date.now) {
  const server = { feed: null as AreaFeed | null, connectionError: false, clock: null as number | null };
  let state = server, generation = 0;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined;
  async function refresh() {
    if (controller || !listeners.size) return;
    clearTimeout(timer);
    const run = generation, active = new AbortController(); controller = active;
    const timeout = setTimeout(() => active.abort(), 20_000);
    async function read(url: string) {
      const response = await request(url, { signal: active.signal, cache: "no-cache" });
      if (!response.ok) throw new Error("Area feed unavailable");
      return acceptAreaFeed(state.feed, await response.json());
    }
    try {
      let next: AreaFeed;
      try { next = await read(AREA_FEED_URL); }
      catch (error) {
        if (state.feed || active.signal.aborted) throw error;
        next = await read(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/elections/2026/areas.json`);
      }
      if (run === generation) state = { feed: next, connectionError: false, clock: now() };
    } catch { if (run === generation) state = { ...state, connectionError: true, clock: now() }; }
    finally {
      clearTimeout(timeout);
      if (run === generation) { controller = undefined; listeners.forEach(l => l()); if (listeners.size) timer = setTimeout(() => void refresh(), 60_000); }
    }
  }
  return { getSnapshot: () => state, getServerSnapshot: () => server, refresh, subscribe(listener: () => void) {
    listeners.add(listener); if (listeners.size === 1) { state = { ...state, clock: now() }; void refresh(); }
    return () => { listeners.delete(listener); if (!listeners.size) { generation++; clearTimeout(timer); controller?.abort(); controller = undefined; } };
  } };
}
