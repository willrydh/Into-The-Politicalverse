import { NOWCAST_PARTIES, type Votes } from "./types";
export function roundedVotes(votes: Votes): Votes {
  const out = Object.fromEntries(
    NOWCAST_PARTIES.map((p) => [p, Math.floor(votes[p])]),
  ) as Votes;
  const remainder =
    Math.round(Object.values(votes).reduce((a, b) => a + b, 0)) -
    Object.values(out).reduce((a, b) => a + b, 0);
  const sorted = [...NOWCAST_PARTIES].sort(
    (a, b) => votes[b] - out[b] - (votes[a] - out[a]) || a.localeCompare(b),
  );
  for (const p of sorted.slice(0, remainder)) out[p]++;
  return out;
}
