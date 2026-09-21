import type { CountedArea } from "./area-types";
import { PARTY_CODE_TO_ID } from "./constants";

export const COUNT_INDICATORS_METHOD = "pv-count-indicators-1.1.0";
/** Fixed categories across elections: eight parliamentary parties + all others.
 * New minor parties may have no individual baseline. Their votes remain in the
 * residual on each side, rather than being assigned invented zero baselines. */
export function nationalCountIndicators(area: CountedArea) {
  const old = area.previous;
  if (!old || !area.validVotes || !old.validVotes) return null;
  const codes = Object.keys(PARTY_CODE_TO_ID);
  const current = codes.map(code => area.parties.find(p => p.code === code));
  const previous = codes.map(code => old.parties.find(p => p.code === code));
  if (current.some(p => p?.share == null) || previous.some(p => p?.share == null || p.votes == null)) return null;
  const currentNamed = current.reduce((s, p) => s + p!.votes, 0), previousNamed = previous.reduce((s, p) => s + p!.votes!, 0);
  if (currentNamed > area.validVotes || previousNamed > old.validVotes) return null;
  const changes = codes.map((code, i) => ({ code, change: current[i]!.share! - previous[i]!.share! })).sort((a, b) => b.change - a.change || a.code.localeCompare(b.code));
  const otherChange = ((area.validVotes - currentNamed) / area.validVotes - (old.validVotes - previousNamed) / old.validVotes) * 100;
  return { gain: changes[0], loss: changes.at(-1)!, volatility: (changes.reduce((s, c) => s + Math.abs(c.change), 0) + Math.abs(otherChange)) / 2 };
}
