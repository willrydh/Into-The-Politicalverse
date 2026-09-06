"use client";
import { Localize } from "@/components/localize";
import type { ElectionForecast } from "@/lib/forecast/types";

export function ForecastEvidenceStrip({ forecast }: { forecast: ElectionForecast }) {
  const facts = [
    { value: forecast.evidence.currentWindowPolls.toLocaleString("sv-SE"), label: "mätningar i aktuell modell" },
    { value: forecast.evidence.currentWindowHouses.toLocaleString("sv-SE"), label: "oberoende mätserier" },
    { value: forecast.evidence.currentWindowInterviews.toLocaleString("sv-SE"), label: "summerade intervjusvar*" },
    { value: forecast.evidence.backtestPartyOutcomes.toLocaleString("sv-SE"), label: "historiska partiutfall" },
    { value: forecast.model.simulations.toLocaleString("sv-SE"), label: "mandatsimuleringar" },
  ];

  return <Localize>{(
    <section className="forecast-evidence" aria-label="Prognosens datagrund">
      <div className="forecast-evidence__intro"><span>DATAGRUND</span><strong>Det här ligger bakom prognosen</strong></div>
      {facts.map((fact) => <div key={fact.label}><strong>{fact.value}</strong><span>{fact.label}</span></div>)}
      <p>*Respondenter kan förekomma i flera mätningar; summan är inte antal unika personer.</p>
    </section>
  )}</Localize>;
}
