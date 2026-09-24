"use client";
import Link from "next/link";
import { useLocale } from "../localize";
import { localizedHref } from "@/lib/i18n/translate";
import type { CandidateCatalog, CandidateElection } from "@/lib/candidates/types";
import { candidateCoverageSelection } from "@/lib/candidates/coverage";

export function CandidateCoverageNotice({ catalog, election, county = "", area = "", profile = false, latestYear }: { catalog: CandidateCatalog; election: CandidateElection; county?: string; area?: string; profile?: boolean; latestYear?: number }) {
  const locale = useLocale(), sv = locale === "sv", coverage = catalog.coverage2026?.[election];
  if (!coverage) return null;
  const {counted, final, expected, complete, established, county: mapCounty} = candidateCoverageSelection(catalog, election, county, area);
  const mapHref = `/maps/?year=2026&election=${election}${mapCounty ? `&county=${mapCounty}` : ""}${election === "KF" && area ? `&municipality=${area}` : ""}`;
  return <p className="local-note candidate-coverage" role="status" data-year="2026" data-complete={complete}>
    <strong>2026 · {established ? (sv ? "Fastställda personröster" : "Final personal votes") : complete ? (sv ? "Räknade personröster · Ej fastställt" : "Counted personal votes · Not yet final") : counted ? (sv ? `Personröster från ${counted}/${expected} områden · ${final} fastställda` : `Personal votes from ${counted}/${expected} areas · ${final} final`) : (sv ? "Inväntar personröster" : "Awaiting personal votes")}</strong>
    {` · ${sv ? "Uppdaterat" : "Updated"} ${catalog.retrievedAt}.`}
    {!established && counted > final && (sv ? " Alla distrikt i redovisade områden är räknade. Siffrorna kan korrigeras före fastställandet." : "All districts in displayed areas have been counted. Figures can be corrected before they become final.")}
    {!complete && (sv ? " Saknade områden inväntar en komplett personrösträkning; saknat är inte noll röster." : "Missing areas await a complete personal-vote count; missing does not mean zero votes.")}
    {!established && counted > 0 && expected > 1 && (sv ? " Profilernas nationella placeringar kräver att hela valet är fastställt." : "National profile standings require the entire election to be final.")}
    {complete && profile && latestYear !== 2026 && (sv ? " Ingen kandidatur från 2026 har kunnat kopplas till den här profilen. Nedan visas senast kopplade val." : "No 2026 candidacy could be linked to this profile. The latest linked election is shown below.")}
    {!complete && profile && latestYear !== 2026 && (sv ? " Nedan visas senast tillgängliga val för den här profilen." : "The latest available election for this profile is shown below.")}
    {!complete && <> <Link href={localizedHref(mapHref, locale)}>{sv ? "Se räknade partiröster" : "View counted party votes"} →</Link></>}
    {!complete && !profile && <> <Link href={localizedHref(`/rankings/?year=2022&election=${election}${county ? `&county=${county}` : ""}${area ? `&area=${area}` : ""}`, locale)}>{sv ? "Visa 2022" : "View 2022"} →</Link></>}
  </p>;
}
