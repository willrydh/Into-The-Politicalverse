"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Localize, useLocale } from "@/components/localize";
import { acceptPublicFeed, feedIsDelayed, LIVE_FEED_URL, LIVE_POLL_INTERVAL_MS, preferredStage } from "@/lib/live/public-feed";
import type { CountingStage, LiveArea, LiveFeed } from "@/lib/live/types";
import { PARTY_CODE_TO_ID } from "@/lib/live/constants";
import { PARTIES } from "@/lib/parties";
import { PartyMark } from "@/components/party-mark";

function ResultTable({ area }: { area: LiveArea }) {
  const locale = useLocale(); const language = locale === "sv" ? "sv-SE" : "en-GB";
  const parties = [...area.parties].sort((a, b) => b.votes - a.votes || a.code.localeCompare(b.code));
  return <Localize><div className="live-table" role="table" aria-label="Räknade röster och officiella mandat">
    <div role="row" className="live-table__head"><span role="columnheader">Parti</span><span role="columnheader">Röster</span><span role="columnheader">Andel</span><span role="columnheader">Mandat</span></div>
    {parties.map(p => <div role="row" key={p.code}>
      <span role="cell" className="live-party">{PARTIES[PARTY_CODE_TO_ID[p.code]] && <PartyMark party={PARTIES[PARTY_CODE_TO_ID[p.code]]} size="sm"/>}{PARTIES[PARTY_CODE_TO_ID[p.code]]?.name ?? p.name}</span>
      <span role="cell">{p.votes.toLocaleString(language)}</span><span role="cell">{p.share === null ? "—" : `${p.share.toLocaleString(language, { maximumFractionDigits: 2 })} %`}</span><strong role="cell">{p.seats ?? "—"}</strong>
    </div>)}
    <div role="row"><span role="cell">Övriga rapporterade partier</span><span role="cell">{area.otherVotes.toLocaleString(language)}</span><span role="cell">{area.validVotes > 0 ? `${(area.otherVotes / area.validVotes * 100).toLocaleString(language, { maximumFractionDigits: 2 })} %` : "—"}</span><span role="cell">—</span></div>
  </div></Localize>;
}

export function ElectionNight({ initialFeed, preparation }: { initialFeed: LiveFeed; preparation: { eligibleVoters: number; districts: number; comparableDistricts: number; registeredParties: number } }) {
  const locale = useLocale(); const language = locale === "sv" ? "sv-SE" : "en-GB";
  const [feed, setFeed] = useState(initialFeed); const accepted = useRef(initialFeed);
  const [connectionError, setConnectionError] = useState(false);
  const [clock, setClock] = useState<number | null>(null);
  const [selection, setSelection] = useState<CountingStage | null>(null); const [areaCode, setAreaCode] = useState("00");
  useEffect(() => {
    let stopped = false; let timer: ReturnType<typeof setTimeout>; let controller: AbortController;
    const update = async () => {
      controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(`${LIVE_FEED_URL}?minute=${Math.floor(Date.now() / LIVE_POLL_INTERVAL_MS)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Live feed unavailable");
        const next = acceptPublicFeed(accepted.current, await response.json());
        if (!stopped) { accepted.current = next; setFeed(next); setConnectionError(false); }
      } catch { if (!stopped) setConnectionError(true); }
      finally { clearTimeout(timeout); if (!stopped) { setClock(Date.now()); timer = setTimeout(update, LIVE_POLL_INTERVAL_MS); } }
    };
    void update();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, []);
  const stage = selection ?? preferredStage(feed); const result = feed.results[stage];
  const area = result ? areaCode === "00" ? result.national : result.constituencies.find(c => c.code === areaCode) ?? result.national : null;
  const delayed = clock !== null && feedIsDelayed(feed.checkedAt, clock);
  const time = (value: string) => new Date(value).toLocaleString(language, { timeZone: "Europe/Stockholm", dateStyle: "medium", timeStyle: "short" });
  const number = (value: number) => value.toLocaleString(language);
  const early = feed.earlyVoting;
  return <Localize><div className="live-page">
    <section className="live-hero">
      <p className="eyebrow eyebrow--light">Sverige · Riksdagsvalet 13 september</p><h1>Valnatten 2026</h1>
      <p>Följ rösträkningen direkt från Valmyndigheten. Röster, rapportering och officiella mandat hålls isär från förvalsprognosen.</p>
      <div className="live-status" role="status" data-state={connectionError || delayed || feed.resultStatus === "degraded" ? "delayed" : result ? "receiving" : "waiting"}>
        <strong>{connectionError || delayed ? "Uppdateringen är fördröjd" : feed.resultStatus === "degraded" ? "En källa behöver kontrolleras" : result ? "Officiell rösträkning" : "Väntar på valresultat"}</strong>
        <span>{connectionError || delayed || feed.resultStatus === "degraded" ? "Senast verifierade uppgifter ligger kvar. Kontrollera tidsstämplarna nedan." : "Resultat visas när Valmyndigheten publicerar dem. Inga genrep visas som valresultat."}</span>
        <small>Senast kontrollerat: {time(feed.checkedAt)} · svensk tid</small>
      </div>
    </section>
    <section className="product-section live-results">
      <div className="live-toolbar"><div className="live-tabs" aria-label="Räkningstillfälle">
        <button aria-pressed={stage === "preliminary"} onClick={() => setSelection("preliminary")}>Preliminär räkning</button>
        <button aria-pressed={stage === "final-count"} onClick={() => setSelection("final-count")}>Slutlig räkning</button>
      </div><Link href="/forecasts" className="text-link">Visa förvalsprognosen →</Link></div>
      <p className="live-explanation">Räkningstillfällena är separata. Slutlig räkning betyder att kontrollräkningen pågår; det är inte automatiskt ett fastställt valresultat.</p>
      {result && area ? <>
        <label className="live-area-label">Välj område<select value={areaCode} onChange={event => setAreaCode(event.target.value)}><option value="00">Hela riket</option>{result.constituencies.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
        <p className="live-source-time">Källan uppdaterad: {time(result.sourceUpdatedAt)} · revision {result.sourceRevision}</p>
        {feed.stageStatus[stage] === "error" && <p role="alert">Källkontrollen misslyckades. Denna tidigare godkända version visas tills en ny version klarar kontrollerna.</p>}
        <div className="live-metrics">
          <article><span>Räknade distrikt</span><strong>{number(area.countedDistricts)} / {number(area.totalDistricts)}</strong><small>Antal distrikt, inte andel räknade röster</small></article>
          <article><span>Giltiga röster</span><strong>{number(area.validVotes)}</strong><small>Ogiltiga röster: {number(area.invalidVotes)}</small></article>
          <article><span>Deltagande i räknade distrikt</span><strong>{area.turnoutInCountedDistricts === null ? "—" : `${area.turnoutInCountedDistricts.toLocaleString(language, { maximumFractionDigits: 2 })} %`}</strong><small>Bygger på röstberättigade i de räknade distrikten</small></article>
        </div>
        {area.countedDistricts > 0 ? <ResultTable area={area} /> : <p className="live-empty">Inga distrikt har rapporterat i detta område ännu.</p>}
        <p className="live-explanation">Röstandelar beräknas från giltiga röster. Tidiga distrikt är inte ett representativt urval. Mandaten är Valmyndighetens publicerade beräkning och kan ändras under räkningen.</p>
        {result.protocolUrl && <a href={result.protocolUrl} target="_blank" rel="noreferrer">Öppna Valmyndighetens protokoll ↗</a>}
      </> : <div className="live-empty"><h2>Rösträkningen har inte publicerats.</h2><p>Vallokalerna stänger klockan 20 den 13 september. Här kommer räknade distrikt, röster, röstandelar och officiella mandat att visas.</p></div>}
    </section>
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
