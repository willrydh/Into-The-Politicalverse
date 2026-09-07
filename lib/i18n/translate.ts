import { messages, type Locale } from "./messages";
import { legacyAliases, messageTemplates } from "./templates";

const dictionary = new Map<string, [string, string]>();
for (const pair of messages) for (const text of pair) dictionary.set(text.replace(/\s+/g, " ").trim(), pair);
const templates = messageTemplates.flatMap(pair => pair.map(source => {
  const keys: string[] = [];
  const expression = source.split(/(\{\w+\})/).map(part => {
    if (/^\{\w+\}$/.test(part)) { keys.push(part.slice(1, -1)); return "(.+?)"; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return { pattern: new RegExp(`^${expression}$`), keys, pair };
}));
const months = [
  ["januari", "jan.", "January", "Jan"], ["februari", "feb.", "February", "Feb"], ["mars", "mars", "March", "Mar"],
  ["april", "apr.", "April", "Apr"], ["maj", "maj", "May", "May"], ["juni", "juni", "June", "Jun"],
  ["juli", "juli", "July", "Jul"], ["augusti", "aug.", "August", "Aug"], ["september", "sep.", "September", "Sept"],
  ["oktober", "okt.", "October", "Oct"], ["november", "nov.", "November", "Nov"], ["december", "dec.", "December", "Dec"],
];

function translatedDate(key: string, locale: Locale): string | null {
  const match = /^(\d{1,2}) ([a-zåäö.]+)(?: (\d{4}))?(?:,? (\d{2}:\d{2}))?$/i.exec(key);
  if (!match) return null;
  const month = months.find(row => row.some(m => m.toLowerCase() === match[2].toLowerCase()) || (row[0] === "september" && match[2].toLowerCase() === "sep"));
  if (!month) return null;
  const long = match[2].length > 4;
  let name = month[locale === "sv" ? long ? 0 : 1 : long ? 2 : 3];
  if (match[2] === match[2].toUpperCase()) name = name.toUpperCase();
  return `${match[1]} ${name}${match[3] ? ` ${match[3]}` : ""}${match[4] ? ` ${match[4]}` : ""}`;
}

export function translateText(text: string, locale: Locale, depth = 0): string {
  const originalKey = text.replace(/\s+/g, " ").trim();
  const key = legacyAliases[originalKey] ?? originalKey;
  const spaced = (value: string) => `${/^\s/.test(text) ? " " : ""}${value}${/\s$/.test(text) ? " " : ""}`;
  const pair = dictionary.get(key);
  if (pair) return spaced(pair[locale === "sv" ? 0 : 1]);
  const date = translatedDate(key, locale);
  if (date) return spaced(date);
  // UI decimals are at most two places; grouped integer counts use triples.
  // Identifiers, version strings and source JSON are not reformatted.
  if (/^[+−-]?\d[\d., ]*(?:–[+−-]?\d[\d., ]*)?\s*%?$/.test(key) && /[., %]/.test(key)) {
    return spaced(key.replace(/[+−-]?\d[\d., ]*/g, token => {
      const trailing = / $/.test(token) ? " " : "";
      const compact = token.trim().replace(/ /g, "");
      const isGrouped = /^[+−-]?\d{1,3}(?:,\d{3})+$/.test(compact);
      const normalized = isGrouped ? compact.replace(/,/g, "") : compact.replace(",", ".");
      if (!/^[+−-]?\d+(?:\.\d{1,2})?$/.test(normalized)) return token;
      const digits = normalized.split(".")[1]?.length ?? 0;
      const value = Number(normalized.replace("−", "-"));
      return `${compact.startsWith("+") ? "+" : ""}${value.toLocaleString(locale === "sv" ? "sv-SE" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${trailing}`;
    }));
  }
  if (depth < 5) {
    for (const template of templates) {
      const match = template.pattern.exec(key);
      if (!match) continue;
      const values = Object.fromEntries(template.keys.map((name, index) => [name, translateText(match[index + 1], locale, depth + 1)]));
      return spaced(template.pair[locale === "sv" ? 0 : 1].replace(/\{(\w+)\}/g, (_, name) => values[name]));
    }
    // Graph labels combine source names, dates and values. Translate the pieces,
    // leaving official geographic names, source titles and numeric values intact.
    const separated = key.split(/(: |, | · )/);
    if (separated.length > 1) return spaced(separated.map((part, i) => i % 2 ? part : translateText(part, locale, depth + 1)).join(""));
    const unit = /^(.*?)\s+(pp|pts)$/.exec(key);
    if (unit) return spaced(`${translateText(unit[1], locale, depth + 1)} ${locale === "sv" ? "procentenheter" : "pp"}`);
    const metric = /^([+−-]?\d+(?:[.,]\d+)?%?) (.+)$/.exec(key);
    if (metric) return spaced(`${translateText(metric[1], locale, depth + 1)} ${translateText(metric[2], locale, depth + 1)}`);
    const nameAndNumber = /^(.+?) ([+−-]?\d+(?:[.,]\d+)?)$/.exec(key);
    if (nameAndNumber) return spaced(`${translateText(nameAndNumber[1], locale, depth + 1)} ${translateText(nameAndNumber[2], locale, depth + 1)}`);
  }
  return text;
}

export const ROUTES = ["", "forecasts", "charts", "parties", "maps", "elections", "indicators", "simulator", "overview", "valnatt", "sources", "search", "rankings", "people"] as const;
export function localizedHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const includesBase = base !== "" && (href === base || href.startsWith(base + "/"));
  const path = includesBase ? href.slice(base.length) : href;
  const withoutLanguage = path.replace(/^\/en(?=\/|#|\?|$)/, "") || "/";
  const route = withoutLanguage.split(/[?#]/)[0].replace(/^\//, "").replace(/\/$/, "");
  if (!(ROUTES as readonly string[]).includes(route)) return href;
  return `${includesBase ? base : ""}${locale === "en" ? "/en" : ""}${withoutLanguage}`;
}
