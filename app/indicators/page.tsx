import type { Metadata } from "next";
import { IndicatorGrid } from "@/components/indicator-grid";
import { calculateNationalIndicators, effectiveNumberOfParties, topTwoConcentration } from "@/lib/indicators/national";

export const metadata: Metadata = { title: "Indicators" };

export default function IndicatorsPage() {
  const indicators = calculateNationalIndicators();

  return (
    <div className="interior-page">
      <header className="interior-hero interior-hero--indicators">
        <div><p className="eyebrow eyebrow--light">Politicalverse indicators</p><h1>Methods before<br /><em>mystique.</em></h1></div>
        <p className="interior-hero__deck">Every indicator has a plain-language definition. These measures describe final election results; none is a forecast.</p>
      </header>
      <section className="interior-panel indicators-page-panel">
        <IndicatorGrid indicators={indicators} />
        <div className="method-list">
          {indicators.map((indicator, index) => (
            <article key={indicator.id} id={indicator.id}>
              <span>PV-{String(index + 1).padStart(2, "0")}</span>
              <div><h2>{indicator.label}</h2><p>{indicator.methodology}</p></div>
              <strong>{indicator.value}</strong>
            </article>
          ))}
        </div>
      </section>
      <section className="secondary-indicators">
        <article><span className="mini-label">Derived · v1.0.0 · System measure</span><strong>{effectiveNumberOfParties()}</strong><h3>Effective number of parties</h3><p>Inverse Herfindahl index using national vote shares. A higher value means votes are distributed across more parties.</p></article>
        <article><span className="mini-label">Derived · v1.0.0 · Concentration</span><strong>{topTwoConcentration().toFixed(2)}%</strong><h3>Top-two vote share</h3><p>The combined final vote share of the two largest parties in the 2022 Riksdag election.</p></article>
      </section>
    </div>
  );
}
