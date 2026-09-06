"use client";
import { Localize } from "@/components/localize";
type ForecastSparklineProps = {
  values: number[];
  label: string;
  threshold?: number;
  color?: string;
};

export function ForecastSparkline({ values, label, threshold, color = "currentColor" }: ForecastSparklineProps) {
  const width = 180;
  const height = 54;
  const padding = 5;
  const domain = threshold === undefined ? values : [...values, threshold];
  const minimum = Math.min(...domain);
  const maximum = Math.max(...domain);
  const span = Math.max(0.01, maximum - minimum);
  const points = values.map((value, index) => {
    const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - minimum) / span) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const thresholdY = threshold === undefined ? null : height - padding - ((threshold - minimum) / span) * (height - padding * 2);

  return <Localize>{(
    <svg className="forecast-sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <title>{label}</title>
      {thresholdY !== null ? <line className="forecast-sparkline__threshold" x1={padding} x2={width - padding} y1={thresholdY} y2={thresholdY} /> : null}
      <polyline points={points} fill="none" stroke={color} />
      {points ? <circle cx={points.split(" ").at(-1)?.split(",")[0]} cy={points.split(" ").at(-1)?.split(",")[1]} r="3.5" fill={color} /> : null}
    </svg>
  )}</Localize>;
}
