import type { LiveFeed } from "../live/types";
import { insist } from "../live/validation";
import { SIMULATOR_PARTY_IDS, type RiksdagElectionInput } from "../simulator/types";
import type { NowcastEstimate } from "./types";
import { calculateRiksdagSeats } from "../simulator/riksdag-rules";

/** Optional scenario inputs cannot invalidate the published projection. */
export function publicScenarioInput(estimate: NowcastEstimate | null, feed: LiveFeed): RiksdagElectionInput | null {
  try {
    const input = estimate?.scenarioInput, official = feed.results.preliminary;
    if (!input || !estimate || !official) return null;
    insist(input.constituencies.length === 29 && new Set(input.constituencies.map(c => c.code)).size === 29, "Incomplete scenario geography");
    const int = (n: number) => Number.isSafeInteger(n) && n >= 0;
    insist(int(input.nationalValidVotes) && input.nationalValidVotes > 0, "Invalid scenario volume");
    for (const c of input.constituencies) {
      const area = official.constituencies.find(a => a.code === c.code);
      insist(area && area.name === c.name && area.fixedSeats === c.fixedSeats, "Wrong scenario constituency");
      insist(int(c.validVotes) && c.validVotes > 0 && SIMULATOR_PARTY_IDS.every(p => int(c.partyVotes[p])), "Invalid scenario votes");
      const named = SIMULATOR_PARTY_IDS.reduce((s, p) => s + c.partyVotes[p], 0);
      insist(named <= c.validVotes && (c.validVotes - named) / c.validVotes < .12, "Unsupported local other-party threshold");
    }
    insist(input.constituencies.reduce((s, c) => s + c.validVotes, 0) === input.nationalValidVotes, "Scenario total differs");
    insist(Math.abs(input.nationalValidVotes - estimate.countedVotes - estimate.estimatedRemainingVotes) <= 29, "Wrong projection volume");
    for (const p of SIMULATOR_PARTY_IDS) {
      const votes = input.constituencies.reduce((s, c) => s + c.partyVotes[p], 0);
      insist(Math.abs(votes - estimate.rows.find(r => r.partyId === p)!.projectedVotes) <= 29, "Wrong projected party votes");
    }
    const named = input.constituencies.reduce((s, c) => s + SIMULATOR_PARTY_IDS.reduce((t, p) => t + c.partyVotes[p], 0), 0);
    insist((input.nationalValidVotes - named) / input.nationalValidVotes < .04, "Unsupported national other-party threshold");
    const result = calculateRiksdagSeats(input);
    insist(result.parties.every(p => estimate.rows.find(r => r.partyId === p.partyId)?.seats === p.totalSeats), "Scenario does not reproduce projection seats");
    return input;
  } catch { return null; }
}
