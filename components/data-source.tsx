"use client";
import { Localize } from "@/components/localize";
export function DataSource({ compact = false, year }: { compact?: boolean; year?: 2026 }) {
  return <Localize>{(
    <a
      className={compact ? "data-source data-source--compact" : "data-source"}
      href={year === 2026 ? "https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026" : "https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022"}
      target="_blank"
      rel="noreferrer"
    >
      <span className="data-source__icon" aria-hidden="true">V</span>
      <span>
        <strong>Official data</strong>
        <small>Valmyndigheten ↗</small>
      </span>
    </a>
  )}</Localize>;
}
