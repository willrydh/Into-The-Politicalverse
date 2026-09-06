import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import { DataSource } from "@/components/data-source";
import { LocalElectionExplorer } from "@/components/maps/local-election-explorer";
import { getLocalIndexModel } from "@/lib/data/geography/local-server";

export const metadata: Metadata = { title: "Valkarta" };

export default function MapsPage({ locale = "sv" }: { locale?: Locale } = {}) {
  const model = getLocalIndexModel();

  return localizeNode((
    <div className="interior-page">
      <header className="interior-hero interior-hero--map">
        <div><p className="eyebrow eyebrow--light">{locale === "sv" ? "21 län · 290 kommuner · 6 264 valdistrikt" : "21 counties · 290 municipalities · 6,264 electoral districts"}</p><h1>{locale === "sv" ? "Valet, plats" : "The election,"}<br /><em>{locale === "sv" ? "för plats." : "place by place."}</em></h1></div>
        <div className="interior-hero__context"><p className="interior-hero__deck">{locale === "sv" ? "Följ partierna från län till kommun och valdistrikt. Utforska officiella röster, historisk styrka och förändring över fyra riksdagsval." : "Follow parties from county to municipality and electoral district. Explore official votes, historical strength and change across four Riksdag elections."}</p><DataSource compact /></div>
      </header>
      <section className="interior-panel interior-panel--map">
        <LocalElectionExplorer model={model} />
      </section>
    </div>
  ), locale);
}
