import type { NationalHistoryData, PartyResult } from "../data/elections/types";
import { PARTY_CODE_TO_ID } from "./constants";
import { isEstablishedResult } from "./headline-result";
import type { LiveFeed } from "./types";

/** Extend the public history only with an established result; never mutate model inputs. */
export function currentNationalHistory(history: NationalHistoryData, feed: LiveFeed): NationalHistoryData {
  const result = feed.results["final-count"];
  if (feed.mode !== "production" || !result || !isEstablishedResult(result)) return history;
  const area = result.national;
  const parties: PartyResult[] = Object.entries(PARTY_CODE_TO_ID).map(([code, partyId]) => {
    const p = area.parties.find(p => p.code === code);
    return { partyId, votes: p?.votes ?? -1, share: p ? p.votes / area.validVotes * 100 : -1, seats: p?.seats ?? undefined };
  });
  if (parties.some(p => p.votes < 0) || area.eligibleVoters <= 0) return history;
  const otherVotes = area.validVotes - parties.reduce((sum, p) => sum + p.votes, 0);
  if (otherVotes < 0) return history;
  parties.push({ partyId: "OTHER", votes: otherVotes, share: otherVotes / area.validVotes * 100, seats: 349 - parties.reduce((sum, p) => sum + (p.seats ?? 0), 0) });
  return {
    ...history,
    source: { ...history.source, retrievedAt: feed.checkedAt, urls: [...history.source.urls.filter(s => s.year !== 2026), { year: 2026, url: result.protocolUrl! }] },
    elections: [...history.elections.filter(e => e.year !== 2026), {
      code: area.code, name: area.name, year: 2026, electionDate: result.electionDate,
      districtCount: area.totalDistricts, validVotes: area.validVotes, totalVotes: area.totalVotes,
      eligibleVoters: area.eligibleVoters, turnout: area.totalVotes / area.eligibleVoters * 100, parties,
    }].sort((a, b) => a.year - b.year),
  };
}
