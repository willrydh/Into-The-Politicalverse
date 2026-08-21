export const PREVIOUS_ELECTION_DATE = new Date("2022-09-11T00:00:00+02:00");
export const NEXT_ELECTION_DATE = new Date("2026-09-13T00:00:00+02:00");

export function daysUntilElection(now: Date): number {
  return Math.max(0, Math.ceil((NEXT_ELECTION_DATE.getTime() - now.getTime()) / 86_400_000));
}

export function electionCycleProgress(now: Date): number {
  const cycle = NEXT_ELECTION_DATE.getTime() - PREVIOUS_ELECTION_DATE.getTime();
  const elapsed = now.getTime() - PREVIOUS_ELECTION_DATE.getTime();
  const progress = Math.min(1, Math.max(0, elapsed / cycle));
  return Math.round(progress * 1_000) / 10;
}
