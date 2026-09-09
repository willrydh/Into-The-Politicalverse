"use client";
import { Localize, useLocale } from "@/components/localize";


import { useSyncExternalStore } from "react";
import { dateInTimeZone } from "@/lib/dates";
import { forecastFreshness } from "@/lib/forecast/freshness";

function subscribe(onChange: () => void) {
  const interval = window.setInterval(onChange, 60_000);
  window.addEventListener("focus", onChange);
  return () => {
    window.clearInterval(interval);
    window.removeEventListener("focus", onChange);
  };
}

function today() { return dateInTimeZone(new Date(), "Europe/Stockholm"); }
function serverDate() { return null; }

export function ForecastFreshness({ dataCutoff, electionDate, compact = false }: { dataCutoff: string; electionDate: string; compact?: boolean }) {
  // The exported HTML always shows the data date. Age is calculated in the
  // browser so a failed future deployment cannot freeze the freshness label.
  const currentDate = useSyncExternalStore(subscribe, today, serverDate);
  const locale = useLocale();
  const freshness = currentDate ? forecastFreshness(dataCutoff, electionDate, currentDate) : null;
  const formattedDate = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: compact ? "short" : "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${dataCutoff}T12:00:00Z`));
  const message = compact && freshness?.state === "recent"
    ? new Intl.RelativeTimeFormat(locale === "sv" ? "sv-SE" : "en-GB", { numeric: "auto" }).format(-freshness.ageDays, "day")
    : freshness?.message;
  return <Localize>{(
    <div className={`forecast-freshness${compact ? " forecast-freshness--compact" : ""}`} data-state={freshness?.state ?? "unknown"} aria-live="polite">
      <strong>Mätdata till <time dateTime={dataCutoff}>{formattedDate}</time>{!compact && "."}</strong>
      {freshness && <span title={compact ? freshness.message : undefined}>{message}</span>}
    </div>
  )}</Localize>;
}
