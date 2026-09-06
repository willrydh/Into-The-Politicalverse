"use client";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback); window.addEventListener("politicalverse:area", callback);
  return () => { window.removeEventListener("popstate", callback); window.removeEventListener("politicalverse:area", callback); };
}
export function useLocalQuery() { return useSyncExternalStore(subscribe, () => window.location.search, () => ""); }
export function navigateLocalQuery(query: string) {
  window.history.pushState(null, "", `${window.location.pathname}${query}`);
  window.dispatchEvent(new Event("politicalverse:area"));
}
