"use client";
import Link from "next/link";
import { useLocale } from "../localize";
import { useLiveFeed } from "./use-live-feed";
import { headlineResult, isEstablishedResult } from "@/lib/live/headline-result";
import { LiveResultTable } from "./result-table";
import { PARTIES } from "@/lib/parties";
import { PARTY_CODE_TO_ID } from "@/lib/live/constants";
import { PartyMark } from "../party-mark";
import { translateText } from "@/lib/i18n/translate";
import { COUNT_INDICATORS_METHOD, nationalCountIndicators } from "@/lib/live/count-indicators";

export function CurrentElection({ view = "table" }: { view?: "table" | "chart" | "indicators" }) {
  const locale = useLocale(), sv = locale === "sv", language = sv ? "sv-SE" : "en-GB";
  const { feed, clock, delayed } = useLiveFeed(), result = headlineResult(feed), area = result?.national;
  const f = (n: number, digits = 2) => n.toLocaleString(language, { maximumFractionDigits: digits });
  const change = (n: number) => `${n >= 0 ? "+" : "−"}${f(Math.abs(n))}`;
  const date = (value: string) => new Date(value).toLocaleString(language, { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const parties = area ? [...area.parties].sort((a, b) => b.votes - a.votes) : [];
  const maximum = Math.max(1, ...parties.map(p => p.share ?? 0), ...area?.previous?.parties.map(p => p.share ?? 0) ?? []);
  const indicators = area ? nationalCountIndicators(area) : null;
  const name = (code: string) => translateText(PARTIES[PARTY_CODE_TO_ID[code]]?.name ?? parties.find(p => p.code === code)?.name ?? code, locale);
  return <section className="interior-panel current-election" id="election-2026" data-classification={view === "indicators" ? "DERIVED" : "OFFICIAL"} data-result-revision={result?.sourceRevision}>
    <div className="panel-heading"><div><span className="mini-label">{view === "indicators" ? `DERIVED · ${COUNT_INDICATORS_METHOD}` : (sv ? "OFFICIELLT · RIKSDAGEN" : "OFFICIAL · RIKSDAG")}</span><h2>{sv ? "2026 jämfört med 2022" : "2026 compared with 2022"}</h2>
      <p>{result && isEstablishedResult(result) ? (sv ? "Fastställt valresultat" : "Final election result") : result?.stage === "final-count" ? (sv ? "Slutlig räkning pågår" : "Final count in progress") : (sv ? "Preliminärt resultat" : "Preliminary result")}{area ? ` · ${f(area.countedDistricts, 0)}/${f(area.totalDistricts, 0)} ${sv ? "distrikt" : "districts"}` : ""}</p></div></div>
    {clock !== null && (delayed || (result && feed.stageStatus[result.stage] === "error")) && <p role="status">{sv ? "Uppdateringen är fördröjd. Senast verifierade resultat visas." : "Update delayed. Showing the last verified result."}</p>}
    {!area ? <p>{sv ? "Inväntar verifierade röster." : "Waiting for verified votes."}</p> : <>
      {view === "chart" && <><p className="local-note">{sv ? "Fylld stapel: 2026 · ljus stapel: 2022. Åtta riksdagspartier; alla partier finns i tabellen." : "Solid bar: 2026 · light bar: 2022. Eight parliamentary parties; all parties are available in the table."}</p><div className="count-comparison-chart">{parties.filter(p => PARTY_CODE_TO_ID[p.code]).map(p => {
        const previous = area.previous?.parties.find(o => o.code === p.code), party = PARTIES[PARTY_CODE_TO_ID[p.code]];
        return <div className="count-comparison-chart__row" key={p.code}><span>{party ? <PartyMark party={party} size="sm" /> : p.name}</span><div><div><i aria-hidden="true" style={{ width: `${(p.share ?? 0) / maximum * 100}%`, background: party?.color ?? "var(--muted)" }} /><span>2026 · {p.share === null ? "—" : `${f(p.share)} %`}</span></div><div><i className="is-previous" aria-hidden="true" style={{ width: `${(previous?.share ?? 0) / maximum * 100}%`, background: party?.color ?? "var(--muted)" }} /><span>2022 · {previous?.share == null ? "—" : `${f(previous.share)} %`}</span></div></div></div>;
      })}</div></>}
      {view === "indicators" ? <>
        {indicators ? <div className="count-indicators"><article><span>{sv ? "Störst andelsökning" : "Largest share gain"}</span><strong>{name(indicators.gain.code)}</strong><b>{change(indicators.gain.change)} pp</b></article><article><span>{sv ? "Störst andelsminskning" : "Largest share loss"}</span><strong>{name(indicators.loss.code)}</strong><b>{change(indicators.loss.change)} pp</b></article><article><span>{sv ? "Nettorörlighet" : "Net volatility"}</span><strong>{f(indicators.volatility)} pp</strong><small>{sv ? "Halva summan av absoluta andelsförändringar: åtta riksdagspartier och övriga som en kategori." : "Half the sum of absolute share changes: eight parliamentary parties and all others as one category."}</small></article></div> : <p>{sv ? "Jämförbart underlag för indikatorerna saknas ännu." : "Comparable data for these indicators is not yet available."}</p>}
        <p className="local-note">{sv ? "Beräknat från räknade röster. Största förändringar avser de åtta riksdagspartierna. Räkningen 2026 jämförs med källans hela 2022-underlag. Nettorörlighet beskriver ändrade partistyrkor, inte hur enskilda väljare bytt parti. Utfallet kan ändras under räkningen." : "Calculated from counted votes. Largest changes refer to the eight parliamentary parties. The 2026 count is compared with the source’s full 2022 baseline. Net volatility describes changes in party support, not individual voters switching parties. Results may change as counting continues."}</p>
      </> : <LiveResultTable area={area} compact />}
    </>}
    <footer className="area-source">{result && <p>{sv ? "Källan uppdaterad" : "Source updated"} {date(result.sourceUpdatedAt)} · {sv ? "svensk tid" : "Swedish time"}.</p>}<Link href={`${sv ? "" : "/en"}/maps/?year=2026`}>{sv ? "Riksdag, region och kommun · alla resultat →" : "Riksdag, regional and municipal elections · all results →"}</Link></footer>
  </section>;
}
