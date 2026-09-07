import type { ElectionIdentity, CandidateYear } from "./types";
export type IdentityInput = ElectionIdentity & { key: string; year: CandidateYear };
// Identity matching deliberately retains diacritics. Hyphen/space differences
// are accepted only with compatible age and a common official municipality.
export const identityName = (name: string) => name.normalize("NFC").toLocaleLowerCase("sv").replace(/[-‐‑–\s]+/g, " ").trim();
const electionDates: Record<CandidateYear, string> = { 2010: "2010-09-19", 2014: "2014-09-14", 2018: "2018-09-09", 2022: "2022-09-11" };
function birthWindow(identity: IdentityInput): [number, number] | null {
  if (identity.ages.length !== 1 || identity.ages[0] < 18 || identity.ages[0] > 110) return null;
  const suffix = electionDates[identity.year].slice(4), year = identity.year - identity.ages[0];
  return [Date.parse(`${year - 1}${suffix}`) + 86400000, Date.parse(`${year}${suffix}`)];
}
function compatible(a: IdentityInput, b: IdentityInput) {
  if (a.year === b.year || !a.municipalities.some(m => b.municipalities.includes(m))) return false;
  const aw = birthWindow(a), bw = birthWindow(b);
  return !!aw && !!bw && Math.max(aw[0], bw[0]) <= Math.min(aw[1], bw[1]);
}
export function linkIdentities(identities: IdentityInput[]) {
  const names = new Map<string, IdentityInput[]>();
  for (const identity of identities) for (const name of new Set(identity.names.map(identityName))) {
    if (!name || name === "namnet gallrat") continue;
    const bucket = names.get(name) ?? []; bucket.push(identity); names.set(name, bucket);
  }
  const neighbors = new Map<string, Set<string>>();
  const index = new Map(identities.map(i => [i.key, i]));
  for (const bucket of names.values()) for (const a of bucket) {
    const matches = bucket.filter(b => compatible(a, b));
    for (const b of matches) {
      if (matches.filter(i => i.year === b.year).length !== 1 || bucket.filter(i => i.year === a.year && compatible(b, i)).length !== 1) continue;
      const edges = neighbors.get(a.key) ?? new Set<string>(); edges.add(b.key); neighbors.set(a.key, edges);
    }
  }
  const groups: IdentityInput[][] = [], visited = new Set<string>();
  for (const identity of identities) {
    if (visited.has(identity.key)) continue;
    const group: IdentityInput[] = [], queue = [identity.key];
    while (queue.length) {
      const key = queue.pop()!; if (visited.has(key)) continue;
      visited.add(key); group.push(index.get(key)!); queue.push(...(neighbors.get(key) ?? []));
    }
    const windows = group.map(birthWindow).filter((w): w is [number, number] => w !== null);
    const safe = new Set(group.map(i => i.year)).size === group.length && (group.length === 1 || windows.length === group.length && Math.max(...windows.map(w => w[0])) <= Math.min(...windows.map(w => w[1])));
    if (safe) groups.push(group.sort((a, b) => a.year - b.year || a.key.localeCompare(b.key)));
    else groups.push(...group.map(i => [i]));
  }
  return groups;
}
