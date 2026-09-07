"use client";
import { PartyGroup } from "@/components/party-label";
import { Localize } from "@/components/localize";
import type { ElectionForecast } from "@/lib/forecast/types";

function linePath(values: number[], minimum: number, maximum: number, width: number, height: number): string {
  return values.map((value, index) => {
    const x = 40 + (index / Math.max(1, values.length - 1)) * (width - 60);
    const y = 18 + ((maximum - value) / (maximum - minimum)) * (height - 52);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export function ForecastHistory({ forecast }: { forecast: ElectionForecast }) {
  const width = 860;
  const height = 260;
  const values = forecast.trend.flatMap((point) => [point.oppositionSeats, point.tidoSeats, 175]);
  const minimum = Math.floor(Math.min(...values) / 10) * 10;
  const maximum = Math.max(minimum + 10, Math.ceil(Math.max(...values) / 10) * 10);
  const majorityY = 18 + ((maximum - 175) / (maximum - minimum)) * (height - 52);
  const first = forecast.trend[0];
  const latest = forecast.trend.at(-1)!;
  const formatDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
  return <Localize>{(
    <div className="forecast-history">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mandatprognosens utveckling för oppositionspartierna och Tidöpartierna">
        <title>Mandatprognosens utveckling</title>
        {[minimum, 175, maximum].map((value) => {
          const y = 18 + ((maximum - value) / (maximum - minimum)) * (height - 52);
          return <g key={value}><line x1="40" x2={width - 20} y1={y} y2={y} /><text x="4" y={y + 4}>{value}</text></g>;
        })}
        <line className="forecast-history__majority" x1="40" x2={width - 20} y1={majorityY} y2={majorityY} />
        <path className="forecast-history__opposition" d={linePath(forecast.trend.map((point) => point.oppositionSeats), minimum, maximum, width, height)} />
        <path className="forecast-history__tido" d={linePath(forecast.trend.map((point) => point.tidoSeats), minimum, maximum, width, height)} />
        <text className="forecast-history__date" x="40" y={height - 5}>{forecast.trend[0].date}</text>
        <text className="forecast-history__date" textAnchor="end" x={width - 20} y={height - 5}>{forecast.trend.at(-1)?.date}</text>
      </svg>
      <div className="forecast-history__legend"><span><i /><PartyGroup parties={["S", "V", "MP", "C"]}/></span><span><i /><PartyGroup parties={["M", "SD", "KD", "L"]}/></span><span><i /> 175 mandat</span></div>
      <div className="forecast-history__summary" aria-label="Textsammanfattning av prognoskurvan">
        <p><span>Första redovisade punkt</span><strong>{formatDate(first.date)}</strong><small><span><PartyGroup parties={["S", "V", "MP", "C"]}/> {first.oppositionSeats}</span><span><PartyGroup parties={["M", "SD", "KD", "L"]}/> {first.tidoSeats}</span></small></p>
        <p><span>Senaste datapunkt</span><strong>{formatDate(latest.date)}</strong><small><span><PartyGroup parties={["S", "V", "MP", "C"]}/> {latest.oppositionSeats}</span><span><PartyGroup parties={["M", "SD", "KD", "L"]}/> {latest.tidoSeats}</span></small></p>
      </div>
      <p className="forecast-history__note">Varje punkt räknas om med den information som hade publicerats vid datumet. Linjen visar modellens mandatmittpunkt, inte observerade valresultat.</p>
    </div>
  )}</Localize>;
}
