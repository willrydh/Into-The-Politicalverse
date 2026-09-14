import { pageMetadata } from "@/lib/page-metadata";
import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import { DataSource } from "@/components/data-source";
import { PartyExplorer } from "@/components/party-explorer";
import { getPartyProfiles } from "@/lib/data/elections";

export const metadata: Metadata = { ...pageMetadata("parties", "sv"), title: "Partier" };

export default function PartiesPage({ locale = "sv" }: { locale?: Locale } = {}) {
  return localizeNode((
    <div className="interior-page">
      <header className="interior-hero interior-hero--party">
        <div><p className="eyebrow eyebrow--light">{locale === "sv" ? "Partier · 2026 och historiken" : "Parties · 2026 and the archive"}</p><h1>One party.<br /><em>Every angle.</em></h1></div>
        <div className="interior-hero__context"><p className="interior-hero__deck">{locale === "sv" ? "Följ partiernas räknade röster 2026, förändringen mot 2022 och stödet i kommunerna. Äldre val finns kvar som fastställd historik." : "Follow parties’ counted 2026 votes, changes from 2022 and municipal support. Earlier elections remain as final historical results."}</p><DataSource compact year={2026} /></div>
      </header>
      <section className="interior-panel interior-panel--flush">
        <PartyExplorer profiles={getPartyProfiles()} />
      </section>
    </div>
  ), locale);
}
