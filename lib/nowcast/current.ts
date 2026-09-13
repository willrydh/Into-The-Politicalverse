import type { LiveFeed } from "../live/types";
import { publicNowcast, publicProbability } from "./public";
import type { NowcastEstimate } from "./types";
import type { SimulatorPartyId } from "../simulator/types";

export function currentProjection(feed: LiveFeed, delayed: boolean) {
  const checked = publicNowcast(feed);
  const estimate = !delayed && checked?.status !== "insufficient" ? checked : null;
  return { estimate, probability: estimate ? publicProbability(estimate) : null, source: estimate ? feed.nowcast!.source! : null };
}
export function projectedCoalitionSeats(estimate: NowcastEstimate | null, parties: readonly SimulatorPartyId[]): number | null {
  if (!estimate || !parties.length || new Set(parties).size !== parties.length) return null;
  const seats = parties.map(p => estimate.rows.find(r => r.partyId === p)?.seats);
  return seats.every((n): n is number => n != null) ? seats.reduce((a, b) => a + b, 0) : null;
}
export function majorityLabel(wins: number, simulations: number, locale: string): string {
  const pct = wins / simulations * 100;
  return pct < 1 ? "<1 %" : pct > 99 ? ">99 %" : `${pct.toLocaleString(locale, { maximumFractionDigits: 0 })} %`;
}
