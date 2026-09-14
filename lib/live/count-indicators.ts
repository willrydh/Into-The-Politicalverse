import type { CountedArea } from "./area-types";

export function nationalCountIndicators(area: CountedArea) {
  const old = area.previous;
  if (!old || !area.validVotes || !old.validVotes || old.otherVotes === null) return null;
  if (old.parties.length !== area.parties.length || area.parties.some(p => p.share === null || old.parties.find(o => o.code === p.code)?.share == null)) return null;
  const changes = area.parties.map(p => ({ code: p.code, change: p.share! - old.parties.find(o => o.code === p.code)!.share! })).sort((a, b) => b.change - a.change || a.code.localeCompare(b.code));
  if (!changes.length) return null;
  const otherChange = (area.otherVotes / area.validVotes - old.otherVotes / old.validVotes) * 100;
  return { gain: changes[0], loss: changes.at(-1)!, volatility: (changes.reduce((s, c) => s + Math.abs(c.change), 0) + Math.abs(otherChange)) / 2 };
}
