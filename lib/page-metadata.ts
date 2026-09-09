import type { Metadata } from "next";
import { PUBLIC_SITE_URL } from "./brand";
import type { Locale } from "./i18n/messages";

export const PUBLIC_PAGES = ["", "forecasts", "charts", "parties", "maps", "elections", "indicators", "simulator", "valnatt", "sources", "rankings", "people", "press", "privacy"] as const;

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
    ...(path === "press" ? { description: locale === "sv"
      ? "Om Politicalverse av William Rydh: syfte, målgrupper, valdata, datakällor och uppdateringar. Gratis för alla, för alltid. Använd materialet med källhänvisning."
      : "About Politicalverse by William Rydh: purpose, audiences, election data, sources and updates. Free for everyone, forever. Use the material with attribution." } : {}),
  };
}
