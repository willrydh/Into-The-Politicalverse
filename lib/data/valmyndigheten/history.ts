import { readFile } from "node:fs/promises";
import type { HistoricalElection, NationalHistoryData, PartyId, PartyResult } from "@/lib/data/elections/types";
import { PARTY_IDS } from "@/lib/data/elections/types";

const ELECTION_METADATA: Record<number, { date: string; validVotes: number; totalVotes: number; eligibleVoters: number; turnout: number }> = {
  2002: { date: "2002-09-15", validVotes: 5_303_212, totalVotes: 5_385_430, eligibleVoters: 6_722_176, turnout: 80.11 },
  2006: { date: "2006-09-17", validVotes: 5_551_278, totalVotes: 5_650_416, eligibleVoters: 6_892_009, turnout: 81.99 },
  2010: { date: "2010-09-19", validVotes: 5_960_408, totalVotes: 6_028_682, eligibleVoters: 7_123_651, turnout: 84.63 },
  2014: { date: "2014-09-14", validVotes: 6_231_573, totalVotes: 6_290_016, eligibleVoters: 7_330_432, turnout: 85.81 },
  2018: { date: "2018-09-09", validVotes: 6_476_725, totalVotes: 6_535_271, eligibleVoters: 7_495_936, turnout: 87.18 },
};

export function parseHistoricalNationalCsv(input: string): HistoricalElection[] {
  const rows = input.trim().split(/\r?\n/);
  const header = rows.shift();

  if (header !== "year;party_id;votes;share") {
    throw new Error("Unexpected Valmyndigheten history CSV header");
  }

  const grouped = new Map<number, PartyResult[]>();

  for (const row of rows) {
    const [yearRaw, partyRaw, votesRaw, shareRaw] = row.split(";");
    const year = Number(yearRaw);
    const partyId = partyRaw as PartyId;

    if (!ELECTION_METADATA[year] || !PARTY_IDS.includes(partyId)) {
      throw new Error(`Unexpected history row: ${row}`);
    }

    const party: PartyResult = {
      partyId,
      votes: Number(votesRaw),
      share: Number(shareRaw),
    };

    grouped.set(year, [...(grouped.get(year) ?? []), party]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([year, parties]) => {
      const metadata = ELECTION_METADATA[year];
      if (parties.length !== PARTY_IDS.length) {
        throw new Error(`Election ${year} has ${parties.length} party rows; expected ${PARTY_IDS.length}`);
      }

      const voteSum = parties.reduce((sum, party) => sum + party.votes, 0);
      if (voteSum !== metadata.validVotes) {
        throw new Error(`Election ${year} party votes sum to ${voteSum}; expected ${metadata.validVotes}`);
      }

      for (const party of parties) {
        const calculatedShare = Math.round(((party.votes / metadata.validVotes) * 100 + Number.EPSILON) * 100) / 100;
        if (party.share !== calculatedShare) {
          throw new Error(`Election ${year} ${party.partyId} share is ${party.share}; expected ${calculatedShare} from official votes`);
        }
      }

      return {
        year,
        electionDate: metadata.date,
        code: "SE",
        name: "Sweden",
        districtCount: 0,
        validVotes: metadata.validVotes,
        totalVotes: metadata.totalVotes,
        eligibleVoters: metadata.eligibleVoters,
        turnout: metadata.turnout,
        parties,
      } satisfies HistoricalElection;
    });
}

export async function loadHistoricalNationalCsv(path: string): Promise<HistoricalElection[]> {
  return parseHistoricalNationalCsv(await readFile(path, "utf8"));
}

export function buildNationalHistoryData(
  elections: HistoricalElection[],
  source: NationalHistoryData["source"],
): NationalHistoryData {
  return { schemaVersion: 1, source, elections };
}
