"use client";

import { useEffect, useState } from "react";
import { useLocale } from "../localize";
import { SortHeaders, useTableSort } from "../table-sort";
import { PartyMark } from "../party-mark";
import { PARTIES } from "@/lib/parties";
import { translateText } from "@/lib/i18n/translate";
import { evaluateForecast, forecastComparisonReference, type ComparisonReference } from "@/lib/forecast/evaluation";
import { validateForecastReference, type ForecastReference } from "@/lib/forecast/reference";
import type { LiveResult } from "@/lib/live/types";

export function ForecastComparisonTable({ reference, comparison, result }: { reference: ComparisonReference; comparison: NonNullable<ReturnType<typeof evaluateForecast>>; result: LiveResult }) {
  const locale = useLocale(), sv = locale === "sv";
  const f = (n: number | null, digits = 0) => n === null ? "—" : n.toLocaleString(sv ? "sv-SE" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const signed = (n: number | null, digits = 0) => n === null ? "—" : `${n > 0 ? "+" : ""}${f(n, digits)}`;
  const table = useTableSort(comparison.rows, [
    {key:"party",label:sv?"Parti":"Party",name:sv?"Parti":"Party",direction:"ascending",value:r=>translateText(PARTIES[r.partyId].name,locale)},
    {key:"forecast",label:sv?"Prognos, %":"Forecast, %",name:sv?"Prognostiserad röstandel":"Forecast vote share",value:r=>r.meanShare},
    {key:"actual",label:sv?"Räknat, %":"Counted, %",name:sv?"Räknad röstandel":"Counted vote share",value:r=>r.actualShare},
    {key:"difference",label:sv?"Utfall − prognos, pp":"Result − forecast, pp",name:sv?"Utfall minus prognos, procentenheter":"Result minus forecast, percentage points",value:r=>r.shareDifference},
    {key:"forecastSeats",label:sv?"Prognos, mandat":"Forecast seats",name:sv?"Prognostiserade mandat":"Forecast seats",value:r=>r.centralSeats},
    {key:"actualSeats",label:sv?"Rapporterade mandat":"Reported seats",name:sv?"Rapporterade mandat":"Reported seats",value:r=>r.actualSeats},
    {key:"seatDifference",label:sv?"Skillnad, mandat":"Seat difference",name:sv?"Mandat minus prognos":"Seats minus forecast",value:r=>r.seatDifference},
  ]);
  return <section className="live-forecast-comparison" id="forecast-comparison" aria-labelledby="forecast-comparison-title" data-classification="DERIVED">
    <span className="mini-label">{sv ? "RIKET · PROGNOS OCH UTFALL" : "NATIONAL · FORECAST AND RESULT"}</span>
    <h2 id="forecast-comparison-title">{sv ? "Så blev det jämfört med prognosen" : "The result compared with the forecast"}</h2>
    <p className="local-note"><strong>{comparison.protocolPublished ? (sv ? "Slutlig räkning med publicerat protokoll" : "Final count with published protocol") : (sv ? "Preliminär jämförelse – räkningen pågår" : "Provisional comparison – counting is ongoing")}</strong> · {f(comparison.countedDistricts)} / {f(comparison.totalDistricts)} {sv ? "räknade distrikt" : "districts counted"}.</p>
    <p className="local-note">{sv ? "Modellprognosen använder mätdata till" : "The model forecast uses polling data through"} <strong>{reference.dataCutoff}</strong>. {sv ? "Skillnaden är räknat utfall minus prognos. Plus betyder högre utfall än prognosen; pp betyder procentenheter." : "Differences are counted results minus the forecast. A positive value means a higher result than forecast; pp means percentage points."}</p>
    <div className="local-table-scroll"><table className="local-table"><thead><tr><SortHeaders control={table}/></tr></thead><tbody>{table.rows.map(r => <tr key={r.partyId}><th scope="row"><PartyMark party={PARTIES[r.partyId]} size="sm"/></th><td>{f(r.meanShare,2)}</td><td>{f(r.actualShare,2)}</td><td>{signed(r.shareDifference,2)}</td><td>{f(r.centralSeats)}</td><td>{f(r.actualSeats)}</td><td>{signed(r.seatDifference)}</td></tr>)}</tbody></table></div>
    {comparison.finalScore ? <p className="local-note">{sv ? "Genomsnittligt absolutfel i röstandel för de åtta prognostiserade partierna" : "Mean absolute vote-share error across the eight forecast parties"}: <strong>{f(comparison.meanAbsoluteError,2)} pp</strong>. {f(comparison.intervalHits)} / 8 {sv ? "partiutfall inom modellens 80-procentiga röstintervall" : "party results within the model’s 80% vote-share intervals"}.</p> : <p className="local-note">{sv ? "Delvis räknade distrikt är inget representativt urval. Samlad prognosutvärdering visas först när samtliga distrikt, mandat och protokoll finns. Rapporterade mandat kan ändras under räkningen." : "Partially counted districts are not a representative sample. The aggregate forecast score appears once all districts, seats and the protocol are available. Reported seats may change during counting."}</p>}
    <details className="local-details"><summary>{sv ? "Prognosversion och beräkning" : "Forecast version and calculation"}</summary><p>{sv ? "Förvalsprognosen är låst från valdagens början. Senare rättelser i myndighetens resultat jämförs mot samma prognos. Detta mäter röster och mandat; det avgör inte vilken regering som bildas." : "The pre-election forecast is frozen at the start of election day. Subsequent official corrections are compared against the same forecast. This compares votes and seats; it does not determine the government."}</p><p>{reference.snapshotId} · {reference.modelVersion}<br/>{sv ? "Sparad" : "Recorded"}: {reference.recordedAt}<br/>{sv ? "Resultatets källtid" : "Result source time"}: {result.sourceUpdatedAt} · {sv ? "revision" : "revision"} {result.sourceRevision}</p><p className="reference-checksum">SHA-256: <code>{reference.forecastSha256}</code></p>{result.protocolUrl && <a href={result.protocolUrl} target="_blank" rel="noreferrer">{sv ? "Valmyndighetens protokoll" : "Official result protocol"} ↗</a>}</details>
  </section>;
}

/** Fetch the last published reference when counting starts, including tabs opened before election day. */
export function ForecastResultComparison({ result }: { result: LiveResult }) {
  const sv = useLocale() === "sv";
  const [reference, setReference] = useState<ComparisonReference | null>(null);
  const [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  const active = result.classification === "OFFICIAL" && result.national.countedDistricts > 0;
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(); let mounted = true;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    async function load() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/forecasts/2026-reference.json`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Reference unavailable");
        const saved = await response.json() as ForecastReference;
        validateForecastReference(saved);
        const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${JSON.stringify(saved.forecast, null, 2)}\n`)))].map(n => n.toString(16).padStart(2,"0")).join("");
        if (hash !== saved.forecastSha256) throw new Error("Reference checksum mismatch");
        if (mounted) { setReference(forecastComparisonReference(saved)); setError(false); }
      } catch { if (mounted) setError(true); }
      finally { clearTimeout(timeout); }
    }
    void load();
    return () => { mounted = false; controller.abort(); clearTimeout(timeout); };
  }, [active, attempt]);
  if (!active) return null;
  if (!reference) return <p className="local-note" role="status">{error ? (sv ? "Prognosjämförelsen kunde inte hämtas." : "The forecast comparison could not be loaded.") : (sv ? "Hämtar den sparade förvalsprognosen…" : "Loading the saved pre-election forecast…")} {error && <button type="button" className="button" onClick={() => setAttempt(n=>n+1)}>{sv ? "Försök igen" : "Try again"}</button>}</p>;
  const comparison = evaluateForecast(reference, result);
  return comparison ? <ForecastComparisonTable reference={reference} comparison={comparison} result={result}/> : null;
}
