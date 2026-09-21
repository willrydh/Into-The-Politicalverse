import { CurrentElection } from "@/components/live/current-election";
import { pageMetadata } from "@/lib/page-metadata";
import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import { CurrentNationalHistory } from "@/components/charts/current-national-history";

export const metadata: Metadata = { ...pageMetadata("charts", "sv"), title: "Grafer" };

export default function ChartsPage({ locale = "sv" }: { locale?: Locale } = {}) {

  return localizeNode((
    <div className="interior-page">
      <header className="interior-hero interior-hero--chart">
        <div><p className="eyebrow eyebrow--light">Charts · National series</p><h1>The chart is<br /><em>the product.</em></h1></div>
        <div className="interior-hero__context"><p className="interior-hero__deck">{locale === "sv" ? "Räknade röster 2026 mot föregående val. Den fastställda historiken fortsätter nu från 2002 till 2026." : "Counted 2026 votes against the previous election. The final historical series now extends from 2002 to 2026."}</p></div>
      </header>
      <CurrentElection view="chart" />
      <CurrentNationalHistory />

    </div>
  ), locale);
}
