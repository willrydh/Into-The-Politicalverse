import type { PartyId } from "../elections/types";

export type PersonalVoteRow = {
  constituency: string; partyCode: string; partyId: PartyId; partyName: string;
  candidateId: string; name: string; list: string; position: string; votes: number;
};
export type PersonalCandidate = {
  id: string; name: string; partyId: PartyId; partyCode: string; partyName: string;
  votes: number; partyVotes: number; lists: number;
};
export type PersonalConstituency = { code: string; name: string; candidates: PersonalCandidate[] };
export type PersonalVoteData = {
  schemaVersion: 1; electionType: "RD"; year: 2022; level: "constituency"; status: "final";
  source: { publisher: "Valmyndigheten"; sourceUrl: string; sourceSha256: string; retrievedAt: string; votesSourceUrl: string; votesSourceSha256: string; methodVersion: "personal-votes-1.0.0" };
  constituencies: PersonalConstituency[];
};
export function personalShare(candidate: Pick<PersonalCandidate, "votes" | "partyVotes">): number | null {
  return candidate.partyVotes > 0 ? candidate.votes / candidate.partyVotes * 100 : null;
}
export function clearsPersonalThreshold(candidate: Pick<PersonalCandidate, "votes" | "partyVotes">): boolean {
  return candidate.partyVotes > 0 && candidate.votes * 20 >= candidate.partyVotes;
}
export function aggregatePersonalVotes(rows: PersonalVoteRow[], partyVotes: Map<string, number>, areas: Array<{ code: string; name: string }>): PersonalConstituency[] {
  const seen = new Set<string>(); const candidates = new Map<string, PersonalCandidate>();
  for (const row of rows) {
    if (!areas.some(a => a.code === row.constituency) || !/^\d+$/.test(row.candidateId) || !row.name || !Number.isSafeInteger(row.votes) || row.votes < 0) throw new Error("Invalid personal-vote row");
    const key = `${row.constituency}:${row.partyCode}:${row.candidateId}`; const rowKey = `${key}:${row.list}:${row.position}`;
    if (seen.has(rowKey)) throw new Error(`Duplicate personal-vote row ${rowKey}`); seen.add(rowKey);
    const denominator = partyVotes.get(`${row.constituency}:${row.partyName}`) ?? 0;
    if (denominator === 0 && row.votes > 0) throw new Error(`Missing party vote denominator ${key}`);
    const candidate = candidates.get(key) ?? { id: row.candidateId, name: row.name, partyId: row.partyId, partyCode: row.partyCode, partyName: row.partyName, votes: 0, partyVotes: denominator, lists: 0 };
    if (candidate.name !== row.name || candidate.partyName !== row.partyName) throw new Error(`Conflicting candidate identity ${key}`);
    candidate.votes += row.votes; candidate.lists++; candidates.set(key, candidate);
  }
  const result = areas.map(area => ({ ...area, candidates: [...candidates].filter(([key]) => key.startsWith(`${area.code}:`)).map(([, c]) => c).sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "sv") || a.id.localeCompare(b.id)) }));
  for (const area of result) {
    const totals = new Map<string, number>();
    for (const c of area.candidates) {
      const total = (totals.get(c.partyCode) ?? 0) + c.votes; totals.set(c.partyCode, total);
      if (c.votes > c.partyVotes || total > c.partyVotes) throw new Error(`Personal votes exceed party votes ${area.code}:${c.partyCode}`);
    }
  }
  return result;
}
