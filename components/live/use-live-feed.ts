"use client";
import { useSyncExternalStore } from "react";
import initial from "@/data/live/election-2026.json";
import { feedIsDelayed, validatePublicFeed } from "@/lib/live/public-feed";
import { createLiveStore } from "@/lib/live/store";
import { currentProjection } from "@/lib/nowcast/current";

const store = createLiveStore(validatePublicFeed(initial));
export function useLiveFeed() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const delayed = state.connectionError || state.clock === null || feedIsDelayed(state.feed.checkedAt, state.clock);
  return { ...state, delayed };
}
export function useCurrentProjection() {
  const state = useLiveFeed();
  return { ...state, ...currentProjection(state.feed, state.delayed) };
}
