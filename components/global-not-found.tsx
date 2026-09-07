"use client";
import { useSyncExternalStore } from "react";
import { LocaleProvider } from "@/components/localize";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import NotFound from "@/app/(sv)/not-found";
import type { Locale } from "@/lib/i18n/messages";
import { BrandIcons } from "@/components/brand-icons";
import { ThemeInit } from "@/components/theme-init";

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}
function currentLanguage(): Locale {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const path = window.location.pathname.slice(base.length);
  return /^\/en(?:\/|$)/.test(path) ? "en" : "sv";
}
// GitHub Pages serves one 404.html for every unmatched path. Resolve its language
// from that path after hydration; normal pages have complete per-language HTML.
export default function GlobalNotFound() {
  const locale = useSyncExternalStore(subscribe, currentLanguage, (): Locale => "sv");
  return <html lang={locale} suppressHydrationWarning><head><title>404 — Politicalverse</title><meta name="robots" content="noindex" /><BrandIcons locale={locale} /><ThemeInit /></head><body><LocaleProvider locale={locale}><SiteHeader /><main><NotFound /></main><SiteFooter /></LocaleProvider></body></html>;
}
