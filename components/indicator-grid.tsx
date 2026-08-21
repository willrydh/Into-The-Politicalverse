import type { Indicator } from "@/lib/indicators/national";

export function IndicatorGrid({ indicators }: { indicators: Indicator[] }) {
  return (
    <div className="indicator-grid">
      {indicators.map((indicator, index) => (
        <article className="indicator-card" key={indicator.id}>
          <div className="indicator-card__top">
            <span className="indicator-card__index">PV-{String(index + 1).padStart(2, "0")}</span>
            <span className="classification-badge">{indicator.classification} · v{indicator.methodologyVersion}</span>
          </div>
          <p>{indicator.label}</p>
          <strong>{indicator.value}</strong>
          <small>{indicator.detail}</small>
        </article>
      ))}
    </div>
  );
}
