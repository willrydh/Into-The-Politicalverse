"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "./localize";

const key = "politicalverse-theme";
const eventName = "politicalverse:theme";
function preference() {
  try { const value = localStorage.getItem(key); return value === "dark" || value === "light" ? value : null; } catch { return null; }
}
function apply(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(eventName));
}
function subscribe(listener: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = () => apply(preference() ?? (media.matches ? "dark" : "light"));
  const systemChanged = () => { if (!preference()) sync(); };
  const storageChanged = (event: StorageEvent) => { if (event.key === key || event.key === null) sync(); };
  window.addEventListener(eventName, listener);
  window.addEventListener("storage", storageChanged);
  media.addEventListener("change", systemChanged);
  return () => {
    window.removeEventListener(eventName, listener);
    window.removeEventListener("storage", storageChanged);
    media.removeEventListener("change", systemChanged);
  };
}
export function ThemeToggle() {
  const sv = useLocale() === "sv";
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark", () => false);
  return <button className="theme-toggle" type="button" aria-pressed={dark} aria-label={sv ? "Mörkt läge" : "Dark mode"} title={sv ? "Växla mellan ljust och mörkt läge" : "Switch between light and dark mode"} onClick={() => {
    const theme = dark ? "light" : "dark";
    try { localStorage.setItem(key, theme); } catch { /* The current page still changes if storage is unavailable. */ }
    apply(theme);
  }}><span aria-hidden="true" className="theme-toggle__moon">☾</span><span aria-hidden="true" className="theme-toggle__sun">☀</span><span className="theme-toggle__label">{sv ? "Mörkt / ljust" : "Dark / light"}</span></button>;
}
