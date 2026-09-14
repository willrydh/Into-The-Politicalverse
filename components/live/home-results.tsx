"use client";

import Link from "next/link";
import { useLocale } from "../localize";
import { PartyGroup } from "../party-label";
import { PartyMark } from "../party-mark";
import { useLiveFeed } from "./use-live-feed";
import { LiveResultTable } from "./result-table";
import { headlineResult, hasCompleteReportedSeats, isEstablishedResult, reportedGroupSeats } from "@/lib/live/headline-result";
import { PARTIES } from "@/lib/parties";
import { PARTY_CODE_TO_ID } from "@/lib/live/constants";
import { translateText } from "@/lib/i18n/translate";

export function HomeResults() {
  const locale = useLocale(), sv = locale === "sv", language = sv ? "sv-SE" : "en-GB";
  const { feed, clock, delayed } = useLiveFeed();
  const result = headlineResult(feed), area = result?.national;
  const established = result ? isEstablishedResult(result) : false;
  const finalCount = result?.stage === "final-count";
  const stale = clock !== null && (delayed || (result && feed.stageStatus[result.stage] === "error"));
  const status = established ? (sv ? "Fastställt valresultat" : "Final election result")
    : finalCount ? (sv ? "Slutlig rösträkning pågår" : "Final count in progress")
    : (sv ? "Preliminärt valresultat" : "Preliminary election result");
  const f = (n: number, digits = 0) => n.toLocaleString(language, { maximumFractionDigits: digits });
  const time = (value: string) => new Date(value).toLocaleString(language, { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const coverage = area && area.totalDistricts > 0 ? area.countedDistricts / area.totalDistricts * 100 : null;
  const seatsComplete = area ? hasCompleteReportedSeats(area) : false;
  const left = area ? reportedGroupSeats(area, ["S", "V", "MP", "C"]) : null;
  const right = area ? reportedGroupSeats(area, ["M", "SD", "KD", "L"]) : null;
  const parties = area ? [...area.parties].sort((a, b) => b.votes - a.votes || a.code.localeCompare(b.code)) : [];
  const href = (path: string) => `${sv ? "" : "/en"}${path}`;
  const phaseNote = established
    ? (sv ? "Samtliga distrikt och mandat är redovisade. Valmyndighetens protokoll är publicerat." : "All districts and seats are reported. The Swedish Election Authority’s protocol is published.")
    : finalCount
      ? (sv ? "Kontrollräkningen pågår. Siffrorna gäller den slutliga räkningen hittills och kan ändras." : "The recount is in progress. These figures cover the final count so far and may change.")
      : (sv ? "Preliminärt resultat. Sena förtids- och utlandsröster samt kontrollräkningen kan ändra siffrorna." : "Preliminary result. Late advance and overseas votes, and the recount, may change these figures.");
  return <>
    <section className="forecast-hero result-home" data-classification="OFFICIAL" data-result-stage={result?.stage} data-result-revision={result?.sourceRevision}>
      <div className="forecast-freshness forecast-freshness--compact" role="status">
        <strong>{result ? status : (sv ? "Inväntar publicerade valresultat" : "Waiting for published results")}</strong>
        {result && <span>{sv ? "Källan uppdaterad" : "Source updated"} <time dateTime={result.sourceUpdatedAt}>{time(result.sourceUpdatedAt)}</time> · {sv ? "svensk tid" : "Swedish time"}</span>}
        {stale && <span>{sv ? "Uppdateringen är fördröjd · senast verifierade resultat visas" : "Update delayed · showing the last verified result"}</span>}
      </div>
      <div className="forecast-hero__grid">
        <div className="forecast-hero__copy">
          <h1>{sv ? "Valresultat" : "Election results"}<br /><em>2026.</em></h1>
          <p className="forecast-hero__deck">{sv ? "Sveriges räknade röster, parti för parti. Röstandelar och mandat direkt från Valmyndigheten, med löpande uppdateringar." : "Sweden’s counted votes, party by party. Vote shares and seats from the Swedish Election Authority, updated as counting progresses."}</p>
          <div className="forecast-hero__meta"><span>{sv ? "OFFICIELLT · VALMYNDIGHETEN" : "OFFICIAL · SWEDISH ELECTION AUTHORITY"}</span><Link href="#roster-2026">{sv ? "Se partiernas röster ↓" : "See party results ↓"}</Link></div>
        </div>
        <article className="forecast-call result-home__count">
          <div className="forecast-call__top"><span>{sv ? "RÖSTRÄKNINGEN" : "VOTE COUNT"}</span><span>{sv ? "RIKSDAGEN" : "RIKSDAG"}</span></div>
          <p>{sv ? "Rapporterade distrikt" : "Reported districts"}</p>
          <strong>{coverage === null ? "—" : `${f(coverage, 1)} %`}</strong>
          {coverage !== null && <div className="forecast-probability-track" role="progressbar" aria-label={sv ? "Andel rapporterade distrikt" : "Share of reported districts"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={coverage}><span style={{ width: `${coverage}%` }} /></div>}
          <small className="result-home__coverage">{area ? `${f(area.countedDistricts)} / ${f(area.totalDistricts)}` : "—"} {sv ? "distrikt · inte andel räknade röster" : "districts · not the share of votes counted"}</small>
          <dl className="result-home__facts">
            <div><dt>{sv ? "Giltiga röster" : "Valid votes"}</dt><dd>{area ? f(area.validVotes) : "—"}</dd></div>
            <div><dt>{sv ? "Deltagande¹" : "Turnout¹"}</dt><dd>{area?.turnoutInCountedDistricts != null ? `${f(area.turnoutInCountedDistricts, 2)} %` : "—"}</dd></div>
          </dl>
          <small className="result-home__coverage">{sv ? "¹ I de rapporterade distrikten." : "¹ In the reported districts."}</small>
        </article>
      </div>
      <div className="mandate-board" aria-label={sv ? "Valmyndighetens mandatfördelning" : "Official seat allocation"}>
        <div className="mandate-board__headline">
          <div><PartyGroup parties={["S", "V", "MP", "C"]} variant="logos" /><strong>{left ?? "—"}</strong><small>{sv ? "rapporterade mandat" : "reported seats"}</small></div>
          <div className="mandate-board__majority"><span>{sv ? "Majoritet" : "Majority"}</span><b>175</b></div>
          <div><PartyGroup parties={["M", "SD", "KD", "L"]} variant="logos" /><strong>{right ?? "—"}</strong><small>{sv ? "rapporterade mandat" : "reported seats"}</small></div>
        </div>
        <div className="mandate-bar">{seatsComplete && parties.map(p => <span key={p.code} style={{ width: `${p.seats! / 349 * 100}%`, background: PARTIES[PARTY_CODE_TO_ID[p.code]]?.color ?? "var(--muted)" }} title={`${translateText(PARTIES[PARTY_CODE_TO_ID[p.code]]?.name ?? p.name, locale)}: ${p.seats}`} />)}</div>
        <div className="mandate-legend">{parties.map(p => <div key={p.code}>{PARTIES[PARTY_CODE_TO_ID[p.code]] ? <PartyMark party={PARTIES[PARTY_CODE_TO_ID[p.code]]} size="sm" /> : <span>{p.abbreviation || p.name}</span>}<strong>{p.seats ?? "—"}</strong></div>)}</div>
        <footer className="mandate-board__update"><p>{sv ? "OFFICIELLT · Mandat enligt Valmyndigheten" : "OFFICIAL · Seats published by the election authority"}</p><p>{established ? (sv ? "Fastställd fördelning. Mandatmajoritet avgör inte ensam vilken regering som bildas." : "Final allocation. A seat majority alone does not determine the government.") : (sv ? "Mandatfördelningen kan ändras under räkningen." : "The seat allocation may change as counting continues.")}</p><Link href={href("/valnatt/")}>{sv ? "Följ hela rösträkningen →" : "Follow the full count →"}</Link></footer>
      </div>
    </section>
    <section className="product-section result-home__results" id="roster-2026" data-classification="OFFICIAL" data-result-stage={result?.stage} data-result-revision={result?.sourceRevision}>
      <p className="eyebrow eyebrow--dark">{sv ? "RIKSDAGSVALET · HELA SVERIGE" : "RIKSDAG ELECTION · ALL OF SWEDEN"}</p>
      <h2>{sv ? "Rösterna, parti för parti." : "The votes, party by party."}</h2>
      <p className="local-note">{phaseNote}</p>
      {area ? <LiveResultTable area={area} compact /> : <p role="status">{sv ? "Räknade röster visas så snart ett verifierat resultat finns." : "Counted votes appear as soon as a verified result is available."}</p>}
      {area && <p className="local-note">{sv ? "Andelar av giltiga röster. Ogiltiga röster:" : "Shares of valid votes. Invalid votes:"} {f(area.invalidVotes)}. {sv ? "Källkontroll:" : "Source checked:"} <time dateTime={feed.checkedAt}>{time(feed.checkedAt)}</time> · {sv ? "svensk tid" : "Swedish time"}.</p>}
      <details className="local-details"><summary>{sv ? "När är rösterna sluträknade?" : "When is the count final?"}</summary>
        <p>{sv ? "Den slutliga rösträkningen börjar den 14 september. Sena förtids- och utlandsröster räknas vid uppsamlingsräkningen från den 16 september. Riksdagsresultatet väntas fastställas ungefär en vecka efter valdagen." : "The final count starts on 14 September. Late advance and overseas votes are included in the collection count from 16 September. The Riksdag result is expected to be established about a week after election day."}</p>
        {!finalCount && <p>{sv ? "Startsidan behåller den preliminära riksbilden medan kontrollräkningen börjar om distrikt för distrikt. När den slutliga räkningen omfattar hela landet tar den över här. Ett fastställt resultat märks först när även alla mandat och myndighetens protokoll finns." : "The homepage retains the national preliminary picture while the recount starts district by district. The final count takes over here once it covers the whole country. The result is labelled final only when all seats and the authority’s protocol are also published."}</p>}
        <a href="https://www.val.se/servicelankar/servicelankar/pressrum/nyheter--pressmeddelanden/nyheter-nya/2026-09-10-sa-har-raknas-rosterna-i-valen" target="_blank" rel="noreferrer">{sv ? "Valmyndigheten: så räknas rösterna" : "Swedish Election Authority: how votes are counted"} ↗</a>
      </details>
      {result?.protocolUrl && <p><a href={result.protocolUrl} target="_blank" rel="noreferrer">{sv ? "Valmyndighetens protokoll" : "Official result protocol"} ↗</a></p>}
      <div className="result-home__links"><Link href={href("/forecasts/")}>{sv ? "Valnattens modellprognos →" : "Election-night model projection →"}</Link><Link href={href("/valnatt/#forecast-comparison")}>{sv ? "Jämför utfallet med förvalsprognosen →" : "Compare the result with the pre-election forecast →"}</Link></div>
    </section>
  </>;
}
