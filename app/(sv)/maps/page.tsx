import { pageMetadata } from "@/lib/page-metadata";
import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import { DataSource } from "@/components/data-source";
import { ElectionExplorer } from "@/components/maps/election-explorer";
import { getLocalIndexModel } from "@/lib/data/geography/local-server";

export const metadata: Metadata = { ...pageMetadata("maps", "sv"), title: "Valkarta" };

export default function MapsPage({ locale = "sv" }: { locale?: Locale } = {}) {
  const model = getLocalIndexModel();

  return localizeNode((
    <div className="interior-page">
      <header className="interior-hero interior-hero--map">
        <div><p className="eyebrow eyebrow--light">{locale === "sv" ? "Valresultat 2026 · 21 län · 290 kommuner" : "2026 election results · 21 counties · 290 municipalities"}</p><h1>{locale === "sv" ? "Valet, plats" : "The election,"}<br /><em>{locale === "sv" ? "för plats." : "place by place."}</em></h1></div>
        <div className="interior-hero__context"><p className="interior-hero__deck">{locale === "sv" ? "Se riksdags-, region- och kommunvalet 2026 med jämförelser mot 2022. Den historiska kartan visar län, kommuner och valdistrikt från tidigare val." : "Explore the 2026 parliamentary, regional and municipal elections with 2022 comparisons. The historical map shows counties, municipalities and electoral districts from earlier elections."}</p><DataSource compact year={2026} /></div>
      </header>
      <section className="interior-panel interior-panel--map">
        <ElectionExplorer model={model} />
      </section>
    </div>
  ), locale);
}
