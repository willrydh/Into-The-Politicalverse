"use client";
import { useSyncExternalStore } from "react";
import { createAreaStore } from "@/lib/live/area-store";
import { feedIsDelayed } from "@/lib/live/public-feed";
const store = createAreaStore();
export function useAreaFeed() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...state, retry: store.refresh, delayed: state.connectionError || (state.feed !== null && state.clock !== null && feedIsDelayed(state.feed.checkedAt, state.clock)) };
}
