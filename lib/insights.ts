// A closed vocabulary prevents queries, candidate selections and input text
// from becoming browsing profiles or leaking into third-party analytics.
export const INSIGHT_PATHS = ["", "overview", "forecasts", "charts", "parties", "maps", "elections", "indicators", "simulator", "valnatt", "sources", "search", "rankings", "people", "privacy"] as const;
export const INSIGHT_EVENTS = ["page", "pocketpolitics", "source_open", "filter_change", "table_sort", "search", "scroll", "LCP", "INP", "CLS", "script_error", "resource_error"] as const;
export type InsightKind = typeof INSIGHT_EVENTS[number];

export function insightPath(input: string): string {
  try {
    const path = new URL(input, "https://politicalverse.se").pathname.replace(/^\/Into-The-Politicalverse(?=\/|$)/, "");
    const match = /^\/(en\/)?([^/]*)\/?$/.exec(path);
    if (!match || !INSIGHT_PATHS.some(value => value === match[2])) return "/404/";
    return `/${match[1] ?? ""}${match[2]}${match[2] ? "/" : ""}`;
  } catch { return "/404/"; }
}

export function insightSource(referrer: string): string {
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (["politicalverse.se", "willrydh.github.io"].includes(host)) return "direct";
    const known = ["google.com", "google.se", "bing.com", "duckduckgo.com", "reddit.com", "facebook.com", "instagram.com", "linkedin.com", "t.co", "pocketpolitics.io"];
    return known.find(domain => host === domain || host.endsWith(`.${domain}`)) ?? "other";
  } catch { return "direct"; }
}

export function insightCampaign(search: string) {
  const p = new URLSearchParams(search);
  const source = p.get("utm_source");
  return {
    source: ["reddit", "facebook", "instagram", "linkedin", "pocketpolitics", "newsletter"].includes(source ?? "") ? source! : "",
    campaign: ["launch", "lansering", "election2026", "val2026"].includes(p.get("utm_campaign") ?? "") ? p.get("utm_campaign")! : "",
  };
}

export function insightDimensions(value: unknown): string {
  if (typeof value !== "string" || !/^\d{2,4}x\d{2,4}$/.test(value)) return "unknown";
  const [width, height] = value.split("x").map(Number);
  return width >= 100 && height >= 100 && width <= 7680 && height <= 7680 ? `${width}x${height}` : "unknown";
}

export function insightDevice(ua: string) {
  const tablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua);
  return {
    device: tablet ? "tablet" : /Mobile|iPhone|iPod/i.test(ua) ? "mobile" : "desktop",
    browser: /Edg\//.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "other",
    os: /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "other",
  };
}
