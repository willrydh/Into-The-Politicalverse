"use client";
import { Localize, useLocale } from "@/components/localize";
import Link from "next/link";
import { PartyGroup, PartyText } from "@/components/party-label";
import { PartyMark } from "@/components/party-mark";
import { PARTY_ORDER, PARTIES } from "@/lib/parties";
import { majorityLabel, projectedCoalitionSeats } from "@/lib/nowcast/current";
import { useCurrentProjection } from "../live/use-live-feed";
import { isEstablishedResult } from "@/lib/live/headline-result";

export function ForecastHero() {
  const { feed, estimate, probability, source, delayed, clock } = useCurrentProjection();
  const language = useLocale() === "sv" ? "sv-SE" : "en-GB";
  const sv = language === "sv-SE", final = feed.results["final-count"];
  if (final && isEstablishedResult(final)) return <section className="forecast-hero" data-classification="OFFICIAL" data-result-revision={final.sourceRevision}>
    <div className="forecast-freshness forecast-freshness--compact"><strong>{sv ? "Fastställt valresultat 2026" : "Final election result 2026"}</strong><span>{sv ? "Valmyndigheten" : "Swedish Election Authority"} · {new Date(final.sourceUpdatedAt).toLocaleDateString(language)}</span></div>
    <div className="forecast-hero__grid"><div className="forecast-hero__copy"><h1>{sv ? <>Prognosen möter<br/><em>valresultatet.</em></> : <>The forecast meets<br/><em>the result.</em></>}</h1><p className="forecast-hero__deck">{sv ? "Jämför prognosen före valet med det fastställda utfallet. Röster och mandat nedan kommer från Valmyndigheten." : "Compare the pre-election forecast with the final outcome. Votes and seats below come from the Swedish Election Authority."}</p></div>
    <article className="forecast-call"><div className="forecast-call__top"><span>{sv ? "RIKSDAGSVALET 2026" : "RIKSDAG ELECTION 2026"}</span><span>OFFICIAL</span></div><p>{sv ? "Rapporterade distrikt" : "Reported districts"}</p><strong>{final.national.countedDistricts.toLocaleString(language)}</strong><small>{sv ? `av ${final.national.totalDistricts.toLocaleString(language)} · samtliga 349 mandat fastställda` : `of ${final.national.totalDistricts.toLocaleString(language)} · all 349 seats final`}</small></article></div>
  </section>;
  const left = projectedCoalitionSeats(estimate, ["S", "V", "MP", "C"]);
  const right = projectedCoalitionSeats(estimate, ["M", "SD", "KD", "L"]);
  const p = probability && probability.unresolved < probability.simulations ? probability : null;
  const rate = p ? p.leftWins / p.simulations * 100 : null;
  const rows = estimate?.rows.filter(r => r.partyId !== "OTHER") ?? [];
  const official = feed.results.preliminary?.national;
  const time = source ? new Date(source.updatedAt).toLocaleString(language, { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  return <Localize><section className="forecast-hero" data-classification="MODEL" data-model-revision={source?.revision}>
    <div className="forecast-freshness forecast-freshness--compact" role="status">
      <strong>{clock === null ? "Hämtar valnattens prognos…" : delayed || feed.nowcast?.status === "error" ? "Prognosen är tillfälligt pausad" : estimate ? "Valnattens prognos" : "Inväntar tillräckligt underlag"}</strong>
      {time && <span><time dateTime={source!.updatedAt}>{time}</time> · svensk tid</span>}
      {official && <span>{official.countedDistricts.toLocaleString(language)} / {official.totalDistricts.toLocaleString(language)} räknade distrikt</span>}
    </div>
    <div className="forecast-hero__grid">
      <div className="forecast-hero__copy">
        <h1>Så tror modellen<br />att valet <em>slutar.</em></h1>
        <p className="forecast-hero__deck">Valnattens räknade distrikt och förändrade röstmönster — sammanvägt till en löpande prognos för hela Sverige.</p>
        <div className="forecast-hero__meta">
          <span className="model-badge">MODELL · EXPERIMENTELL V2</span>
          {p && <span>{p.simulations.toLocaleString(language)} simulerade val</span>}
        </div>
      </div>
      <article className="forecast-call">
        <div className="forecast-call__top"><span>VALNATTENS PROGNOS</span><span>PV/V2</span></div>
        <p><PartyText>Når S, V, MP och C minst 175 mandat?</PartyText></p>
        <strong>{p ? majorityLabel(p.leftWins, p.simulations, language) : "—"}</strong>
        {rate !== null && <><div className="forecast-probability-track" role="progressbar" aria-label="S, V, MP och C: minst 175 mandat" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rate)}><span style={{ width: `${rate}%` }} /></div><div className="forecast-call__labels"><span>NEJ</span><span>JA</span></div></>}
        <small className="forecast-call__caveat">Träffsäkerheten är inte belagd. Siffrorna beror på modellens antaganden.</small>
        <details><summary>Vad betyder sannolikheten?</summary>
          <p>Andelen av valnattsmodellens simuleringar som ger minst 175 mandat. Det är mandatmajoritet, inte sannolikheten att bilda regering.</p>
          {p && p.unresolved > 0 && <p>{p.unresolved} av {p.simulations} simuleringar kan inte mandatfördelas. De ingår i nämnaren.</p>}
          {!p && <p>Visas när valnattsprognosen har tillräckligt verifierat underlag och simuleringarna kan beräknas.</p>}
        </details>
      </article>
    </div>
    <div className="mandate-board" aria-label="Central mandate forecast">
      <div className="mandate-board__headline">
        <div><PartyGroup parties={["S", "V", "MP", "C"]} variant="logos"/><strong>{left ?? "—"}</strong><small>mandat i valnattsprognosen</small></div>
        <div className="mandate-board__majority"><span>Majoritet</span><b>175</b></div>
        <div><PartyGroup parties={["M", "SD", "KD", "L"]} variant="logos"/><strong>{right ?? "—"}</strong><small>mandat i valnattsprognosen</small></div>
      </div>
      <div className="mandate-bar">{[...rows].sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0)).map(r => r.seats !== null && <span key={r.partyId} style={{ width: `${r.seats / 349 * 100}%`, background: PARTIES[r.partyId].color }} title={`${PARTIES[r.partyId].name}: ${r.seats}`} />)}</div>
      <div className="mandate-legend">{PARTY_ORDER.filter(party => party !== "OTHER").map(party => <div key={party}><PartyMark party={PARTIES[party]} size="sm"/><strong>{rows.find(r => r.partyId === party)?.seats ?? "—"}</strong></div>)}</div>
      <footer className="mandate-board__update">
        <p><span className="model-badge">MODEL</span> Samma löpande prognos som på valnattsidan.</p>
        {estimate && <p>{(estimate.estimatedRemainingVotes / (estimate.countedVotes + estimate.estimatedRemainingVotes) * 100).toLocaleString(language, { maximumFractionDigits: 1 })} % av röstvolymen uppskattas.</p>}
        <Link href="/forecasts">Öppna hela prognosen <span>→</span></Link>
      </footer>
    </div>
  </section></Localize>;
}
