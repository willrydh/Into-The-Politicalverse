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
  return <p className="local-note candidate-coverage" role="status" data-year="2026" data-complete={complete}>
    <strong>2026 · {complete ? (sv ? "Fastställda personröster" : "Final personal votes") : ready ? (sv ? `${ready}/${selection.length} områden fastställda` : `${ready}/${selection.length} areas final`) : (sv ? "Inväntar fastställda personröster" : "Awaiting final personal votes")}</strong>
    {complete ? ` · ${sv ? "Källa kontrollerad" : "Source checked"} ${catalog.retrievedAt}.` : ` · ${sv ? "Räkningen hos Valmyndigheten pågår. Saknade 2026-resultat är inte noll röster." : "The Election Authority’s count is ongoing. Missing 2026 results do not mean zero votes."}`}
    {!complete && ready > 0 && (sv ? " Listan omfattar bara fastställda områden; nationella placeringar tilldelas först när hela valet finns." : "Only final areas are included; national standings are awarded once the whole election is available.")}
    {complete && profile && latestYear !== 2026 && (sv ? " Ingen kandidatur från 2026 har kunnat kopplas till den här profilen. Nedan visas senast kopplade val." : "No 2026 candidacy could be linked to this profile. The latest linked election is shown below.")}
    {!complete && profile && (sv ? " Nedan visas senast tillgängliga val för den här profilen." : "The latest available election for this profile is shown below.")}
    {!complete && !profile && <> <Link href={localizedHref(`/rankings/?year=2022&election=${election}${county ? `&county=${county}` : ""}${area ? `&area=${area}` : ""}`, locale)}>{sv ? "Visa 2022" : "View 2022"} →</Link></>}
  </p>;
}
