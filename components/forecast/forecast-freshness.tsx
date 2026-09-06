"use client";

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

export function ForecastFreshness({ dataCutoff, electionDate }: { dataCutoff: string; electionDate: string }) {
  // The exported HTML always shows the data date. Age is calculated in the
  // browser so a failed future deployment cannot freeze the freshness label.
  const currentDate = useSyncExternalStore(subscribe, today, serverDate);
  const freshness = currentDate ? forecastFreshness(dataCutoff, electionDate, currentDate) : null;
  const formattedDate = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${dataCutoff}T12:00:00Z`));
  return (
    <div className="forecast-freshness" data-state={freshness?.state ?? "unknown"} aria-live="polite">
      <strong>Mätdata till <time dateTime={dataCutoff}>{formattedDate}</time>.</strong>
      {freshness && <span>{freshness.message}</span>}
    </div>
  );
}
