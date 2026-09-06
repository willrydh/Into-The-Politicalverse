import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import { DataSource } from "@/components/data-source";
import { MunicipalityElectionMap } from "@/components/maps/municipality-election-map";
import { getMunicipalityMapModel } from "@/lib/data/geography";

export const metadata: Metadata = { title: "Valkarta" };

export default function MapsPage({ locale = "sv" }: { locale?: Locale } = {}) {
  const model = getMunicipalityMapModel();

  return localizeNode((
    <div className="interior-page">
      <header className="interior-hero interior-hero--map">
        <div><p className="eyebrow eyebrow--light">Election map · 290 comparable municipalities</p><h1>Every place.<br /><em>Every change.</em></h1></div>
        <div className="interior-hero__context"><p className="interior-hero__deck">Explore final 2022 Riksdag vote share, turnout and transparent 2018→2022 swing across every Swedish municipality—without a login.</p><DataSource compact /></div>
      </header>
      <section className="interior-panel interior-panel--map">
        <MunicipalityElectionMap model={model} />
      </section>
    </div>
  ), locale);
}
