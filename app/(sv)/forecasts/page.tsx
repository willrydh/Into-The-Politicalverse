import { pageMetadata } from "@/lib/page-metadata";
import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import Link from "next/link";
import { ForecastHero } from "@/components/forecast/forecast-hero";
import { CurrentForecast } from "@/components/forecast/current-forecast";
import { PreElectionArchive } from "@/components/forecast/pre-election-archive";

export const metadata = { ...pageMetadata("forecasts", "sv"), title: "Valresultat mot prognos 2026", description: "Fastställt valresultat, röstandelar, mandat och jämförelse med prognosen före valet." };
export default function ForecastsPage({ locale = "sv" }: { locale?: Locale } = {}) {
  return localizeNode(<>
    <ForecastHero />
    <div className="live-home-link"><Link href="/valnatt">Till valnattens presentation →</Link><Link href="/simulator">Till mandatsimulatorn →</Link></div>
    <CurrentForecast />
    <details className="pre-election-archive" id="fore-valet">
      <summary>Prognosen före valet · arkiv</summary>
      <p className="pre-election-archive__note">Detta är prognosen från före valet. Den är fryst för efterkontroll och styr inga aktuella prognossiffror på sajten.</p>
      <PreElectionArchive locale={locale} />
    </details>
  </>, locale);
}
