import { PARTY_CODE_TO_ID } from "./constants";
import type { LiveArea, LiveFeed, LiveResult } from "./types";
import type { SimulatorPartyId } from "../simulator/types";

export function allDistrictsCounted(result: LiveResult): boolean {
  const n = result.national;
  return n.totalDistricts > 0 && n.countedDistricts === n.totalDistricts;
}

export function hasCompleteReportedSeats(area: LiveArea): boolean {
  return area.parties.length > 0 && area.parties.every(p => p.seats !== null)
    && area.parties.reduce((sum, p) => sum + (p.seats ?? 0), 0) === 349;
}

export function isEstablishedResult(result: LiveResult): boolean {
  return result.classification === "OFFICIAL" && result.stage === "final-count"
    && result.national.validVotes > 0
    && allDistrictsCounted(result) && result.protocolUrl !== null
    && hasCompleteReportedSeats(result.national);
}

/** Keep the national preliminary picture while the separate recount starts over. */
export function headlineResult(feed: LiveFeed): LiveResult | null {
  if (feed.mode !== "production") return null;
  const available = (r: LiveResult | null) => r?.classification === "OFFICIAL"
    && r.electionDate === feed.electionDate && r.national.code === "00"
    && r.national.countedDistricts > 0 && r.national.validVotes > 0 ? r : null;
  const preliminary = available(feed.results.preliminary);
  const final = available(feed.results["final-count"]);
  return final && (allDistrictsCounted(final) || !preliminary) ? final : preliminary;
}

/** Sums only published mandates; no forecast or eight-party allocation fallback. */
export function reportedGroupSeats(area: LiveArea, ids: readonly SimulatorPartyId[]): number | null {
  if (!hasCompleteReportedSeats(area) || !ids.length || new Set(ids).size !== ids.length) return null;
  const values = ids.map(id => area.parties.find(p => PARTY_CODE_TO_ID[p.code] === id)?.seats);
  return values.every((n): n is number => n != null) ? values.reduce((sum, n) => sum + n, 0) : null;
}
