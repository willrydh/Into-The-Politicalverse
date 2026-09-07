// Build-time only. Raw workbooks and full data models never enter the browser bundle.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";
import { PARTIES } from "../parties";
import { translateText, ROUTES } from "../i18n/translate";
import { electionArchive } from "../elections/outcomes";
import { normalizeSearch, validateSearchIndex } from "./engine";
import { SEARCH_PAGES, SEARCH_TOPICS } from "./catalog";
import { bilingual as b, type SearchEntry, type SearchIndex } from "./types";
import { validateLocalities, type LocalityData } from "./localities";
import type { LocalDistrictData, LocalElectionIndex } from "../data/geography/local-types";
import type { PersonalVoteData } from "../data/geography/personal-votes";
import type { GovernmentFormationContext } from "../forecast/government";
import type { ElectionForecast } from "../forecast/types";

const read = <T,>(file: string): T => JSON.parse(readFileSync(join(process.cwd(), "data", file), "utf8"));
const translated = (value: string) => b(translateText(value, "sv"), translateText(value, "en"));
const mapHref = (values: Record<string, string>, fragment = "local-results") => `/maps/?${new URLSearchParams({ year: "2022", ...values })}#${fragment}`;

/** Index visible text literals from every local component dependency, in both
 * languages. New prose is picked up at build time; no HTML or source code is served. */
function pageText(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file) || !existsSync(file)) return [];
  seen.add(file);
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const strings: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxText(node) || (ts.isStringLiteral(node) && !ts.isImportDeclaration(node.parent) && !ts.isJsxAttribute(node.parent) && /\s/.test(node.text))) {
      const value = node.text.replace(/\s+/g, " ").trim();
      if (value.length > 3 && /\p{L}/u.test(value) && !/[{}]|=>/.test(value)) strings.push(translateText(value, "sv"), translateText(value, "en"));
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const modulePath = node.moduleSpecifier.text;
      const path = modulePath.startsWith("@/") ? join(process.cwd(), modulePath.slice(2)) : modulePath.startsWith(".") ? resolve(dirname(file), modulePath) : "";
      if (path && !path.includes("/i18n/") && !path.includes("/search/") && !path.endsWith("/localize")) {
        const target = [".tsx", ".ts", "/index.ts"].map(ext => path + ext).find(existsSync);
        if (target) strings.push(...pageText(target, seen));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source); return strings;
}

export function buildSearchIndex(): SearchIndex {
  const entries: SearchEntry[] = [...SEARCH_TOPICS];
  const geography = read<LocalElectionIndex>("normalized/local-election-index.json");
  const districts = read<LocalDistrictData>("normalized/local-election-districts.json");
  const personal = read<PersonalVoteData>("normalized/personal-votes-2022.json");
  const localities = read<LocalityData>("normalized/scb-localities-2023.json");
  const government = read<GovernmentFormationContext>("context/government-formation-2026.json");
  const forecast = read<ElectionForecast>("normalized/election-forecast-2026.json");
  const counties = new Map(geography.counties.map(c => [c.code, c]));
  const municipalities = new Map(geography.municipalities.map(m => [m.code, m]));
  validateLocalities(localities, new Set(municipalities.keys()));
  for (const route of ROUTES) if (!["search", "overview", ...SEARCH_PAGES.map(p => p.route)].includes(route)) throw new Error(`Missing search page ${route}`);
  for (const page of SEARCH_PAGES) {
    const words = pageText(join(process.cwd(), "app/(sv)", page.route, "page.tsx"));
    entries.push({ id: `page:${page.route || "home"}`, type: "page", href: `/${page.route}${page.route ? "/" : ""}`, title: page.title, description: page.description, keywords: [...new Set(words)].join(" ") });
  }
  for (const c of geography.counties) entries.push({ id: `county:${c.code}`, type: "county", title: b(c.name), description: b(`Län · Riksdagsval 2010–2022 · ${c.code}`, `County · Riksdag elections 2010–2022 · ${c.code}`), href: mapHref({ county: c.code }) });
  for (const m of geography.municipalities) {
    const county = counties.get(m.parent!)!;
    entries.push({ id: `municipality:${m.code}`, type: "municipality", title: b(m.name), description: b(`Kommun · ${county.name} · ${m.code}`, `Municipality · ${county.name} · ${m.code}`), href: mapHref({ county: county.code, municipality: m.code }) });
    for (const d of districts.municipalities[m.code]) {
      entries.push({ id: `district:${d.code}`, type: "district", title: d.level === "collection" ? b(`Uppsamlingsröster · ${m.name}`, `Collection votes · ${m.name}`) : b(d.name), description: b(`${d.level === "collection" ? "Röstgrupp" : "Valdistrikt"} 2022 · ${m.name} · ${county.name} · ${d.code}`, `${d.level === "collection" ? "Vote group" : "Electoral district"} 2022 · ${m.name} · ${county.name} · ${d.code}`), href: mapHref({ county: county.code, municipality: m.code, district: d.code }), keywords: d.comparison?.previousNames.join(" ") });
    }
  }
  for (const place of localities.localities) {
    const links = place.municipalities.map(code => {
      const m = municipalities.get(code)!;
      return { title: b(`Valresultat i ${m.name}`, `Election results in ${m.name}`), href: mapHref({ county: m.parent!, municipality: code }), keywords: counties.get(m.parent!)!.name };
    });
    entries.push({ id: `locality:${place.code}`, type: "locality", title: b(place.name), description: b("Tätort · SCB 2023. Länkarna visar kommunernas valresultat; tätorten är ett annat geografiskt område.", "Urban locality · Statistics Sweden 2023. Links show municipal election results; the locality is a different geographic area."), keywords: place.code, href: links[0].href, links });
  }
  for (const p of Object.values(PARTIES)) {
    if (p.id === "OTHER") continue;
    const name = translated(p.name);
    entries.push({ id: `party:${p.id}`, type: "party", title: name, description: b(`Parti · ${p.id} · Historik, röster och mandat`, `Party · ${p.id} · History, votes and seats`), href: `/parties/?party=${p.id}#party-profile`, keywords: p.id === "L" ? "Folkpartiet FP Liberals" : "" });
  }
  // Candidate histories are served as a compact, separately validated payload.
  // Keep the general page/geography index small and out of the shared header.
  for (const c of personal.constituencies) entries.push({ id: `constituency:${c.code}`, type: "constituency", title: b(c.name), description: b(`Riksdagsvalkrets · Personröster 2010–2022 · ${c.code}`, `Riksdag constituency · Personal votes 2010–2022 · ${c.code}`), href: mapHref({ constituency: c.code }, "personal-votes") });
  for (const p of government.partyContexts) for (const name of p.leaders) entries.push({ id: `leader:${p.partyId}:${name}`, type: "person", title: b(name), description: b(`${PARTIES[p.partyId].name} · Daterad regeringskontext 2026`, `${translateText(PARTIES[p.partyId].name, "en")} · Dated government context 2026`), href: `/forecasts/#leader-${p.partyId}`, keywords: p.claims.flatMap(c => [c.headline, c.summary, translateText(c.headline, "en"), translateText(c.summary, "en")]).join(" ") });
  for (const claim of government.constitutionalClaims) entries.push({ id: `context:${claim.id}`, type: "topic", title: translated(claim.headline), description: translated(claim.summary), href: "/forecasts/#regering", keywords: `${claim.source.publisher} ${claim.source.title}` });
  for (const question of forecast.questions) entries.push({ id: `question:${question.id}`, type: "topic", title: translated(question.question), description: b(`MODELL · Prognos 2026. ${translateText(question.resolution, "sv")}`, `MODEL · Forecast 2026. ${translateText(question.resolution, "en")}`), href: `/forecasts/#${question.id}`, keywords: `${question.explanation} ${translateText(question.explanation, "en")}` });
  for (const publisher of [...new Set([forecast.source.dataset, ...forecast.source.primaryCrossChecks.map(s => s.publisher)])]) entries.push({ id: `poll-source:${publisher}`, type: "source", title: b(publisher), description: b("Opinionsmätningar · Prognosens källor och primärkontroller", "Opinion polls · Forecast sources and primary cross-checks"), href: "/forecasts/#metod" });
  for (const election of electionArchive.elections) {
    const href = `/elections/#election-${election.year}`;
    entries.push({ id: `election:${election.year}`, type: "election", href, title: b(`Riksdagsvalet ${election.year}`, `Riksdag election ${election.year}`), description: b(`Block, mandat och regeringen med ${election.government.primeMinister}.`, `Blocs, seats and the government led by ${election.government.primeMinister}.`), keywords: election.blocs.flatMap(g => [g.name.sv, g.name.en, ...g.parties]).join(" ") });
    entries.push({ id: `government:${election.year}`, type: "person", href, title: b(election.government.primeMinister), description: b(`Statsminister efter valet ${election.year} · Historisk regeringsbildning`, `Prime minister following the ${election.year} election · Historical government formation`) });
  }
  // The source catalogue's static objects are indexed individually and retain
  // the same order/anchors as the rendered catalogue.
  const sourceFile = ts.createSourceFile("sources.tsx", readFileSync("app/(sv)/sources/page.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let sourceNumber = 0;
  function visitSource(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      const fields = Object.fromEntries(node.properties.flatMap(p => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && ts.isStringLiteral(p.initializer) ? [[p.name.text, p.initializer.text]] : []));
      if (fields.name && fields.use) entries.push({ id: `source:${sourceNumber}`, type: "source", title: translated(fields.name), description: translated(fields.use), href: `/sources/#source-${sourceNumber++}`, keywords: fields.format });
    }
    ts.forEachChild(node, visitSource);
  }
  visitSource(sourceFile);
  // Normalize once during export to keep the download compact.
  for (const e of entries) if (e.keywords) e.keywords = [...new Set(normalizeSearch(e.keywords).split(" "))].join(" ");
  const version = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
  const index: SearchIndex = { schemaVersion: 1, version, entries };
  validateSearchIndex(index); return index;
}
