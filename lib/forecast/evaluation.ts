import { PARTY_CODE_TO_ID } from "../live/constants";
import type { LiveResult } from "../live/types";
import { validateForecastReference, type ForecastReference } from "./reference";

export function forecastComparisonReference(reference: ForecastReference) {
  validateForecastReference(reference);
  const f = reference.forecast;
  return {
    snapshotId: f.snapshotId, modelVersion: f.model.version, electionDate: f.model.electionDate,
    dataCutoff: f.model.dataCutoff, generatedAt: f.model.generatedAt, recordedAt: reference.recordedAt,
    freezeAt: reference.freezeAt, forecastSha256: reference.forecastSha256,
    parties: f.parties.map(p => ({ partyId: p.partyId, meanShare: p.meanShare, centralSeats: p.centralSeats, shareInterval80: p.shareInterval80, seatInterval80: p.seatInterval80 })),
  };
}
export type ComparisonReference = ReturnType<typeof forecastComparisonReference>;

/** National forecast vs national counted votes. Partial counts never become a final model score. */
export function evaluateForecast(reference: ComparisonReference, result: LiveResult | null) {
  if (!result || result.classification !== "OFFICIAL" || result.electionDate !== reference.electionDate
    || Date.parse(result.sourceUpdatedAt) < Date.parse("2026-09-13T18:00:00Z")
    || result.national.code !== "00" || result.national.validVotes <= 0 || result.national.countedDistricts <= 0) return null;
  const national = result.national;
  const allDistricts = national.totalDistricts > 0 && national.countedDistricts === national.totalDistricts;
  const protocolPublished = result.stage === "final-count" && allDistricts && result.protocolUrl !== null;
  const officialSeatsComplete = national.parties.every(p => p.seats !== null) && national.parties.reduce((s, p) => s + (p.seats ?? 0), 0) === 349;
  const rows = reference.parties.map(p => {
    const actual = national.parties.find(a => PARTY_CODE_TO_ID[a.code] === p.partyId);
    const share = actual ? actual.votes / national.validVotes * 100 : null;
    const seats = actual?.seats ?? null;
    return { ...p, actualShare: share, actualSeats: seats, shareDifference: share === null ? null : share - p.meanShare,
      seatDifference: seats === null ? null : seats - p.centralSeats,
      inShareInterval: share === null ? null : share >= p.shareInterval80[0] && share <= p.shareInterval80[1] };
  });
  const completeShares = rows.every(r => r.shareDifference !== null);
  const finalScore = protocolPublished && completeShares && officialSeatsComplete;
  return { rows, protocolPublished, finalScore, countedDistricts: national.countedDistricts, totalDistricts: national.totalDistricts,
    meanAbsoluteError: finalScore ? rows.reduce((sum, r) => sum + Math.abs(r.shareDifference!), 0) / rows.length : null,
    intervalHits: finalScore ? rows.filter(r => r.inShareInterval).length : null };
}
