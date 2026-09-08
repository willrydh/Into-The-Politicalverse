import type { Metadata } from "next";
import { PUBLIC_SITE_URL } from "./brand";
import type { Locale } from "./i18n/messages";

export const PUBLIC_PAGES = ["", "forecasts", "charts", "parties", "maps", "elections", "indicators", "simulator", "valnatt", "sources", "rankings", "people"] as const;

export function publicPageUrl(path: string, locale: Locale = "sv") {
  const canonicalPath = path === "overview" ? "" : path;
  return new URL(`${locale === "en" ? "en/" : ""}${canonicalPath}${canonicalPath ? "/" : ""}`, PUBLIC_SITE_URL).href;
}

export function pageMetadata(path: string, locale: Locale): Metadata {
  return {
    alternates: {
      canonical: publicPageUrl(path, locale),
      languages: { sv: publicPageUrl(path), en: publicPageUrl(path, "en"), "x-default": publicPageUrl(path) },
    },
    ...(path === "search" ? { robots: { index: false, follow: true } } : {}),
  };
}
