"use client";

import { NowcastPanel } from "./nowcast";
import { ElectionBroadcastHero } from "./broadcast-hero";
import { SvtValuPanel } from "./svt-valu";
import type { SvtValu } from "@/lib/data/svt-valu";
import { ForecastResultComparison } from "./forecast-comparison";
import { useState } from "react";
import { useLiveFeed } from "./use-live-feed";
import Link from "next/link";
import { Localize, useLocale } from "@/components/localize";
import { LIVE_FEED_URL, preferredStage } from "@/lib/live/public-feed";
import type { CountingStage } from "@/lib/live/types";
import { LiveResultTable } from "./result-table";
import { isEstablishedResult } from "@/lib/live/headline-result";

export function ElectionNight({ preparation, valu }: { valu: SvtValu; preparation: { eligibleVoters: number; districts: number; comparableDistricts: number; registeredParties: number } }) {
  const locale = useLocale(); const language = locale === "sv" ? "sv-SE" : "en-GB";
  const { feed, connectionError, delayed } = useLiveFeed();
  const [selection, setSelection] = useState<CountingStage | null>(null); const [areaCode, setAreaCode] = useState("00");
  const stage = selection ?? preferredStage(feed); const result = feed.results[stage];
  const established = !!result && isEstablishedResult(result);
  const area = result ? areaCode === "00" ? result.national : result.constituencies.find(c => c.code === areaCode) ?? result.national : null;
  const time = (value: string) => new Date(value).toLocaleString(language, { timeZone: "Europe/Stockholm", dateStyle: "medium", timeStyle: "short" });
  const number = (value: number) => value.toLocaleString(language);
  const early = feed.earlyVoting;
  return <Localize><div className="live-page">
    <ElectionBroadcastHero state={connectionError || delayed || feed.resultStatus === "degraded" ? "delayed" : (result?.national.countedDistricts ?? 0) > 0 ? "receiving" : "waiting"} established={established} checkedAt={feed.checkedAt} countedDistricts={result?.national.countedDistricts ?? 0} totalDistricts={result?.national.totalDistricts ?? preparation.districts}/>
    <SvtValuPanel survey={valu}/>
    <section className="product-section live-results">
      <div className="live-toolbar"><div className="live-tabs" aria-label="Räkningstillfälle">
        <button aria-pressed={stage === "preliminary"} onClick={() => setSelection("preliminary")}>Preliminär räkning</button>
        <button aria-pressed={stage === "final-count"} onClick={() => setSelection("final-count")}>Slutlig räkning</button>
      </div><Link href="/forecasts#fore-valet" className="text-link">Visa förvalsprognosen →</Link></div>
      <p className="live-explanation">{established ? (locale === "sv" ? "Riksdagsvalets resultat är fastställt. Samtliga distrikt och 349 mandat är redovisade, och Valmyndighetens protokoll är publicerat. Den preliminära räkningen finns kvar som ett separat räkningstillfälle." : "The Riksdag result is established. All districts and 349 seats are reported, and the Election Authority's protocol is published. The preliminary count remains available as a separate counting stage.") : "Räkningstillfällena är separata. Slutlig räkning betyder att kontrollräkningen pågår; det är inte automatiskt ett fastställt valresultat."}</p>
      {result && area ? <>
        <label className="live-area-label">Välj område<select value={areaCode} onChange={event => setAreaCode(event.target.value)}><option value="00">Hela riket</option>{result.constituencies.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
        <p className="live-source-time">Källan uppdaterad: {time(result.sourceUpdatedAt)} · revision {result.sourceRevision}</p>
        {feed.stageStatus[stage] === "error" && <p role="alert">Källkontrollen misslyckades. Denna tidigare godkända version visas tills en ny version klarar kontrollerna.</p>}
        <div className="live-metrics">
          <article><span>Räknade distrikt</span><strong>{number(area.countedDistricts)} / {number(area.totalDistricts)}</strong><small>Antal distrikt, inte andel räknade röster</small></article>
          <article><span>Giltiga röster</span><strong>{number(area.validVotes)}</strong><small>Ogiltiga röster: {number(area.invalidVotes)}</small></article>
          <article><span>Deltagande i räknade distrikt</span><strong>{area.turnoutInCountedDistricts === null ? "—" : `${area.turnoutInCountedDistricts.toLocaleString(language, { maximumFractionDigits: 2 })} %`}</strong><small>Bygger på röstberättigade i de räknade distrikten</small></article>
        </div>
        {area.countedDistricts > 0 ? <LiveResultTable area={area} /> : <p className="live-empty">Inga distrikt har rapporterat i detta område ännu.</p>}
        <p className="live-explanation">{established ? (locale === "sv" ? "Röstandelar beräknas från giltiga röster. Mandaten följer Valmyndighetens fastställda fördelning. Eventuella officiella rättelser kontrolleras före publicering." : "Vote shares use valid votes. Seats follow the Election Authority's established allocation. Any official corrections are verified before publication.") : "Röstandelar beräknas från giltiga röster. Tidiga distrikt är inte ett representativt urval. Mandaten är Valmyndighetens publicerade beräkning och kan ändras under räkningen."}</p>
        {result.protocolUrl && <a href={result.protocolUrl} target="_blank" rel="noreferrer">Öppna Valmyndighetens protokoll ↗</a>}
        {area.code === "00" && <ForecastResultComparison result={result}/>}
      </> : <div className="live-empty"><h2>Rösträkningen har inte publicerats.</h2><p>Vallokalerna stänger klockan 20 den 13 september. Här kommer räknade distrikt, röster, röstandelar och officiella mandat att visas.</p></div>}
    </section>
    {stage === "preliminary" && <NowcastPanel feed={feed} delayed={connectionError || delayed}/> }
    <section className="product-section live-preparation"><p className="eyebrow eyebrow--dark">OFFICIAL · Inför valet</p><h2>Mer data redan före valnatten</h2>
      <div className="live-metrics">
        <article><span>Mottagna förtidsröster i Sverige</span><strong>{early ? number(early.receivedVotes) : "—"}</strong><small>{early ? <>Hämtat: {time(early.retrievedAt)}</> : "Källan saknas"}</small></article>
        <article><span>Röstberättigade till riksdagen</span><strong>{number(preparation.eligibleVoters)}</strong><small>Kvalifikationsdagen 14 augusti 2026</small></article>
        <article><span>Valdistrikt i 2026 års indelning</span><strong>{number(preparation.districts)}</strong><small>{number(preparation.comparableDistricts)} kan jämföras med 2022 enligt Valmyndigheten</small></article>
      </div>
      <p>Förtidsrösterna är mottagna röster, inte räknade partiröster eller slutligt valdeltagande. Dagens värden kan vara ofullständiga och rättas i efterhand.</p>
      {feed.earlyVotingStatus === "error" && <p role="alert">Förtidsröstningskällan kunde inte uppdateras. En tidigare kontrollerad uppgift kan visas.</p>}
      <p>{number(preparation.registeredParties)} partier finns i riksdagens deltagarregister. Under den preliminära räkningen särredovisas rapportpartier; övriga röster redovisas samlat.</p>
      <Link className="text-link" href="/sources">Utforska datakällorna →</Link>
    </section>
    <section className="product-section live-method"><h2>Så hålls valresultaten kontrollerbara</h2>
      <p>Digitala signaturer, kontrollsummor, validentitet, räkningstillfälle och summeringar kontrolleras före publicering. Testdata och bakåtgående källversioner stoppas. Röster kan däremot minska när Valmyndigheten rättar en uppgift.</p>
      <p>Webbläsaren söker en ny verifierad version varje minut. Hämtningen från myndigheten är schemalagd ungefär var femte minut under räkningen; köer och källans publicering kan ge längre intervall.</p>
      <a href={LIVE_FEED_URL}>Hämta den senaste verifierade datafilen (JSON) →</a>
    </section>
  </div></Localize>;
}
