"use client";
import { SortHeaders, MobileTableSort, useTableSort } from "@/components/table-sort";
import { translateText } from "@/lib/i18n/translate";
import { Localize, useLocale } from "@/components/localize";
import { PartyMark } from "@/components/party-mark";
import type { ElectionForecast } from "@/lib/forecast/types";
import { PARTIES } from "@/lib/parties";

function pct(value: number): string {
  if (value >= 0.9995) return ">99,9 %";
  if (value <= 0.0005) return "<0,1 %";
  return `${(value * 100).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} %`;
}

export function PartySeatForecast({ forecast }: { forecast: ElectionForecast }) {
  const locale = useLocale(), sv = locale === "sv";
  const table = useTableSort(forecast.parties, [
    {key:"party",label:sv?"Parti":"Party",name:sv?"Parti":"Party",direction:"ascending",value:p=>translateText(PARTIES[p.partyId].name,locale)},
    {key:"share",label:sv?"Röstprognos":"Vote forecast",name:sv?"Röstprognos":"Vote forecast",value:p=>p.meanShare},
    {key:"seats",label:sv?"Mandat":"Seats",name:sv?"Mandat":"Seats",value:p=>p.centralSeats},
    {key:"interval",label:sv?"80 % intervall":"80% interval",name:sv?"Mandatintervallets bredd":"Seat interval width",value:p=>p.seatInterval80[1]-p.seatInterval80[0]},
    {key:"threshold",label:sv?"Över 4 %":"Above 4%",name:sv?"Sannolikhet över 4 %":"Probability above 4%",value:p=>p.thresholdProbability},
  ]);
  const chartMaximum = Math.max(...forecast.parties.map((party) => party.seatInterval80[1]));

  return <Localize>{(
    <div className="seat-forecast">
      <MobileTableSort control={table} className="table-sort-tablet"/><div role="table" aria-label={sv?"Partiernas prognoser":"Party forecasts"}><div className="seat-forecast__head" role="row">
        <SortHeaders control={table} as="span"/>
      </div>
      {table.rows.map((party) => {
        const definition = PARTIES[party.partyId];
        return (
          <article role="row" className="seat-forecast__row" key={party.partyId}>
            <div role="cell" className="seat-party"><PartyMark party={definition} size="md" /><div><strong>{definition.name}</strong></div></div>
            <div role="cell" className="seat-share"><strong>{party.meanShare.toLocaleString("sv-SE")} %</strong><span>{party.shareInterval80[0].toLocaleString("sv-SE")}–{party.shareInterval80[1].toLocaleString("sv-SE")} %</span></div>
            <div role="cell" className="seat-number"><strong>{party.centralSeats}</strong><span>median {party.medianSeats}</span></div>
            <div role="cell" className="seat-range" aria-label={`${definition.name}: 80-procentigt mandatintervall ${party.seatInterval80[0]} till ${party.seatInterval80[1]}`}>
              <div aria-hidden="true"><span style={{ left: `${(party.seatInterval80[0] / chartMaximum) * 100}%`, width: `${((party.seatInterval80[1] - party.seatInterval80[0]) / chartMaximum) * 100}%`, background: definition.color }} /><b style={{ left: `${(party.medianSeats / chartMaximum) * 100}%` }} /></div>
              <span>{party.seatInterval80[0]}–{party.seatInterval80[1]} mandat</span>
            </div>
            <div role="cell" className={`threshold-signal ${party.thresholdProbability < .5 ? "threshold-signal--risk" : ""}`}><strong>{pct(party.thresholdProbability)}</strong><span>modellsannolikhet</span></div>
          </article>
        );
      })}
      </div><footer>
        <span>Centralprognosen summerar exakt till 349 mandat.</span>
        <span>Intervallen visar 10:e–90:e percentilen och behöver inte summera till 349.</span>
        <span>Övriga är en samlad restkategori och får inga mandat i v1; modellen skattar inte att ett nytt namngivet parti tar sig in.</span>
      </footer>
    </div>
  )}</Localize>;
}
