import { PARTY_CODE_TO_ID } from "../live/constants";
import type { LiveResult } from "../live/types";
import { NOWCAST_PARTIES, type NowcastEstimate } from "./types";

/** Grade an archived prediction only against a later, complete official count. */
export function evaluateNowcastOutcome(
  estimate: NowcastEstimate,
  committedAt: string,
  result: LiveResult,
) {
  if (
    result.stage !== "final-count" ||
    result.national.countedDistricts !== result.national.totalDistricts ||
    result.national.validVotes <= 0 ||
    !Number.isFinite(Date.parse(committedAt)) ||
    !(Date.parse(committedAt) < Date.parse(result.sourceUpdatedAt)) ||
    estimate.status !== "experimental" ||
    estimate.rows.length !== 9
  )
    return null;
  const totals = Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0]));
  const seats = Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0]));
  totals.OTHER = result.national.otherVotes;
  for (const p of result.national.parties) {
    const id = PARTY_CODE_TO_ID[p.code] ?? "OTHER";
    totals[id] += p.votes;
    if (p.seats !== null) seats[id] += p.seats;
  }
  const rows = estimate.rows.map((p) => ({
    party: p.partyId,
    projectedShare: p.projectedShare,
    finalShare: (100 * totals[p.partyId]) / result.national.validVotes,
    errorPp:
      p.projectedShare - (100 * totals[p.partyId]) / result.national.validVotes,
    projectedSeats: p.seats,
    finalSeats: result.national.parties.every((r) => r.seats !== null)
      ? seats[p.partyId]
      : null,
  }));
  const partyMaePp = rows
    .filter((r) => r.party !== "OTHER")
    .reduce((s, r) => s + Math.abs(r.errorPp) / 8, 0);
  const majority =
    Object.values(seats).reduce((s, n) => s + n, 0) === 349
      ? seats.S + seats.V + seats.MP + seats.C >= 175
        ? "left"
        : seats.M + seats.KD + seats.SD + seats.L >= 175
          ? "right"
          : "neither"
      : null;
  const p = estimate.probability;
  // Unresolved draws are unknown outcomes, not predictions of "neither".
  // One realized election is an outcome score, never a calibration study.
  const majorityBrier =
    p &&
    majority &&
    p.unresolved === 0 &&
    p.leftWins + p.rightWins === p.simulations
      ? (p.leftWins / p.simulations - Number(majority === "left")) ** 2 +
        (p.rightWins / p.simulations - Number(majority === "right")) ** 2 +
        (p.unresolved / p.simulations - Number(majority === "neither")) ** 2
      : null;
  return {
    partyMaePp,
    rows,
    majority,
    majorityBrier,
    probabilityInterpretation:
      "Single-election outcome score; not evidence of probability calibration. Withheld when simulations contain unresolved outcomes.",
  };
}
