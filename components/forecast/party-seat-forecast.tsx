import { PartyMark } from "@/components/party-mark";
import type { ElectionForecast } from "@/lib/forecast/types";
import { PARTIES } from "@/lib/parties";

function pct(value: number): string {
  if (value >= 0.9995) return ">99,9 %";
  if (value <= 0.0005) return "<0,1 %";
  return `${(value * 100).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} %`;
}

export function PartySeatForecast({ forecast }: { forecast: ElectionForecast }) {
  const chartMaximum = Math.max(...forecast.parties.map((party) => party.seatInterval80[1]));

  return (
    <div className="seat-forecast">
      <div className="seat-forecast__head" aria-hidden="true">
        <span>Parti</span><span>Röstprognos</span><span>Mandat</span><span>80 % intervall</span><span>Över 4 %</span>
      </div>
      {forecast.parties.map((party) => {
        const definition = PARTIES[party.partyId];
        return (
          <article className="seat-forecast__row" key={party.partyId}>
            <div className="seat-party"><PartyMark party={definition} size="md" /><div><strong>{definition.name}</strong><span>{party.partyId}</span></div></div>
            <div className="seat-share"><strong>{party.meanShare.toLocaleString("sv-SE")} %</strong><span>{party.shareInterval80[0].toLocaleString("sv-SE")}–{party.shareInterval80[1].toLocaleString("sv-SE")} %</span></div>
            <div className="seat-number"><strong>{party.centralSeats}</strong><span>median {party.medianSeats}</span></div>
            <div className="seat-range" aria-label={`${definition.name}: 80-procentigt mandatintervall ${party.seatInterval80[0]} till ${party.seatInterval80[1]}`}>
              <div aria-hidden="true"><span style={{ left: `${(party.seatInterval80[0] / chartMaximum) * 100}%`, width: `${((party.seatInterval80[1] - party.seatInterval80[0]) / chartMaximum) * 100}%`, background: definition.color }} /><b style={{ left: `${(party.medianSeats / chartMaximum) * 100}%` }} /></div>
              <span>{party.seatInterval80[0]}–{party.seatInterval80[1]} mandat</span>
            </div>
            <div className={`threshold-signal ${party.thresholdProbability < .5 ? "threshold-signal--risk" : ""}`}><strong>{pct(party.thresholdProbability)}</strong><span>modellsannolikhet</span></div>
          </article>
        );
      })}
      <footer>
        <span>Centralprognosen summerar exakt till 349 mandat.</span>
        <span>Intervallen visar 10:e–90:e percentilen och behöver inte summera till 349.</span>
        <span>Övriga är en samlad restkategori och får inga mandat i v1; modellen skattar inte att ett nytt namngivet parti tar sig in.</span>
      </footer>
    </div>
  );
}
