import type { BallotPosition } from "./types";

export function validateBallotPositions(value: unknown, partyCode: string): asserts value is BallotPosition[] {
  if (!Array.isArray(value)) throw new Error("Missing ballot-position data");
  const seen = new Set<string>();
  for (const ballot of value) {
    if (!ballot || typeof ballot.listNumber !== "string" || !/^\d{4}-\d{5}$/.test(ballot.listNumber) || !ballot.listNumber.startsWith(`${partyCode}-`) || !Number.isSafeInteger(ballot.position) || ballot.position < 1) throw new Error("Invalid ballot position");
    const key = `${ballot.listNumber}:${ballot.position}`;
    if (seen.has(key)) throw new Error("Duplicate ballot position");
    seen.add(key);
  }
}

export function summarizeBallotPositions(ballots: BallotPosition[]) {
  return {
    positions: [...new Set(ballots.map(b => b.position))].sort((a, b) => a - b),
    lists: new Set(ballots.map(b => b.listNumber)).size,
  };
}
