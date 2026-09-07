import { FORECAST_PARTY_IDS, type ElectionForecast } from "./types";
import { insist } from "../live/validation";

export const FORECAST_FREEZE_AT = "2026-09-12T22:00:00.000Z"; // Start of election day, Europe/Stockholm.
export const FORECAST_REFERENCE_METHOD = "pv-forecast-reference-1.0.0";
export type ForecastReference = {
  schemaVersion: 1;
  methodVersion: typeof FORECAST_REFERENCE_METHOD;
  freezeAt: typeof FORECAST_FREEZE_AT;
  recordedAt: string;
  forecastSha256: string;
  forecast: ElectionForecast;
};

export function forecastReferenceFrozen(now: string): boolean {
  insist(Number.isFinite(Date.parse(now)), "Invalid forecast reference clock");
  return Date.parse(now) >= Date.parse(FORECAST_FREEZE_AT);
}

export function validateForecastReference(reference: ForecastReference): void {
  insist(reference.schemaVersion === 1 && reference.methodVersion === FORECAST_REFERENCE_METHOD && reference.freezeAt === FORECAST_FREEZE_AT, "Unsupported forecast reference");
  insist(/^[a-f0-9]{64}$/.test(reference.forecastSha256), "Missing forecast reference checksum");
  const f = reference.forecast;
  insist(f.schemaVersion === 1 && f.classification === "MODEL" && f.model.electionDate === "2026-09-13", "Wrong forecast reference election or classification");
  insist(/^\d{4}-\d{2}-\d{2}$/.test(f.model.dataCutoff) && f.model.dataCutoff < f.model.electionDate, "Forecast reference includes election-day data");
  insist(!forecastReferenceFrozen(reference.recordedAt) && !forecastReferenceFrozen(f.model.generatedAt), "Forecast reference was recorded after the freeze");
  insist(Date.parse(f.model.generatedAt) <= Date.parse(reference.recordedAt), "Forecast reference precedes forecast generation");
  insist(f.parties.length === FORECAST_PARTY_IDS.length && new Set(f.parties.map(p => p.partyId)).size === FORECAST_PARTY_IDS.length, "Incomplete forecast reference parties");
  insist(FORECAST_PARTY_IDS.every(id => f.parties.some(p => p.partyId === id)), "Unknown forecast reference party");
  for (const p of f.parties) {
    insist(Number.isFinite(p.meanShare) && p.meanShare >= 0 && p.meanShare <= 100, "Invalid reference share");
    insist(Number.isSafeInteger(p.centralSeats) && p.centralSeats >= 0, "Invalid reference seats");
    for (const [interval, max] of [[p.shareInterval80, 100], [p.seatInterval80, 349]] as const) {
      insist(interval.length === 2 && interval.every(n => Number.isFinite(n) && n >= 0 && n <= max) && interval[0] <= interval[1], "Invalid reference interval");
    }
  }
  insist(f.parties.reduce((sum, p) => sum + p.centralSeats, 0) === 349, "Reference mandates do not sum to 349");
}

/** An existing pre-election reference is immutable after the boundary, including manual refreshes. */
export function selectForecastReference(previous: ForecastReference | null, forecast: ElectionForecast, forecastSha256: string, now: string): ForecastReference {
  if (previous) validateForecastReference(previous);
  if (forecastReferenceFrozen(now)) {
    insist(previous, "No pre-election forecast reference exists; do not create one retrospectively");
    return previous;
  }
  if (previous?.forecastSha256 === forecastSha256) return previous;
  const next: ForecastReference = { schemaVersion: 1, methodVersion: FORECAST_REFERENCE_METHOD, freezeAt: FORECAST_FREEZE_AT, recordedAt: now, forecastSha256, forecast };
  validateForecastReference(next);
  if (previous) insist(forecast.model.generatedAt >= previous.forecast.model.generatedAt && forecast.model.dataCutoff >= previous.forecast.model.dataCutoff, "Forecast reference regressed");
  return next;
}
