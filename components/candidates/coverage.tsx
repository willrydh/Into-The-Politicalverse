"use client";
import Link from "next/link";
import { useLocale } from "../localize";
import { localizedHref } from "@/lib/i18n/translate";
import type { CandidateCatalog, CandidateElection } from "@/lib/candidates/types";

export function CandidateCoverageNotice({ catalog, election, county = "", area = "", profile = false, latestYear }: { catalog: CandidateCatalog; election: CandidateElection; county?: string; area?: string; profile?: boolean; latestYear?: number }) {
  const locale = useLocale(), sv = locale === "sv", coverage = catalog.coverage2026?.[election];
  if (!coverage) return null;
  const all = election === "KF" ? catalog.municipalities.map(a => ({ code: a.code, county: a.parent })) : election === "RD" ? catalog.constituencies : catalog.counties.filter(a => a.code !== "09").map(a => ({ code: a.code, county: a.code }));
  const selection = all.filter(a => (!county || a.county === county) && (!area || a.code === area));
  const ready = selection.filter(a => coverage.final.includes(a.code)).length, complete = ready === selection.length && ready > 0;
  const mapCounty = county || all.find(a => a.code === area)?.county;
  const mapHref = `/maps/?year=2026&election=${election}${mapCounty ? `&county=${mapCounty}` : ""}${election === "KF" && area ? `&municipality=${area}` : ""}`;
  return <p className="local-note candidate-coverage" role="status" data-year="2026" data-complete={complete}>
    <strong>2026 · {complete ? (sv ? "Fastställda personröster" : "Final personal votes") : ready ? (sv ? `${ready}/${selection.length} områden fastställda` : `${ready}/${selection.length} areas final`) : (sv ? "Inväntar fastställda personröster" : "Awaiting final personal votes")}</strong>
    {` · ${sv ? "Uppdaterat" : "Updated"} ${catalog.retrievedAt}.`}
    {!complete && (sv ? " Personröster tas in när räkning, mandat och protokoll är fastställda. Ett saknat resultat betyder inte noll röster." : "Personal votes are added when the count, seats and protocol are final. A missing result does not mean zero votes.")}
    {!complete && ready > 0 && (sv ? " Nationella placeringar kräver hela valet." : "National standings require the complete election.")}
    {complete && profile && latestYear !== 2026 && (sv ? " Ingen kandidatur från 2026 har kunnat kopplas till den här profilen. Nedan visas senast kopplade val." : "No 2026 candidacy could be linked to this profile. The latest linked election is shown below.")}
    {!complete && profile && (sv ? " Nedan visas senast tillgängliga val för den här profilen." : "The latest available election for this profile is shown below.")}
    {!complete && <> <Link href={localizedHref(mapHref, locale)}>{sv ? "Se räknade partiröster" : "View counted party votes"} →</Link></>}
    {!complete && !profile && <> <Link href={localizedHref(`/rankings/?year=2022&election=${election}${county ? `&county=${county}` : ""}${area ? `&area=${area}` : ""}`, locale)}>{sv ? "Visa 2022" : "View 2022"} →</Link></>}
  </p>;
}
