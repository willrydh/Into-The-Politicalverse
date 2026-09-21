import type { LiveFeed } from "../live/types";
import { insist } from "../live/validation";
import { SIMULATOR_PARTY_IDS, type RiksdagElectionInput } from "../simulator/types";
import type { NowcastEstimate } from "./types";
import { calculateRiksdagSeats } from "../simulator/riksdag-rules";
import { isEstablishedResult } from "../live/headline-result";
import { PARTY_CODE_TO_ID } from "../live/constants";

/** Reproduce every published party mandate before using the official count as a
 * scenario baseline. Unsupported minor-party thresholds or lots stay closed. */
export function officialScenarioInput(feed: LiveFeed): RiksdagElectionInput | null {
  const result = feed.results["final-count"];
  if (!result || !isEstablishedResult(result) || result.seatCheck.status !== "matched") return null;
  try {
    const input: RiksdagElectionInput = {
      nationalValidVotes: result.national.validVotes,
      constituencies: result.constituencies.map(c => ({ code: c.code, name: c.name, fixedSeats: c.fixedSeats, validVotes: c.validVotes, partyVotes: Object.fromEntries(SIMULATOR_PARTY_IDS.map(id => [id, c.parties.find(p => PARTY_CODE_TO_ID[p.code] === id)?.votes ?? 0])) as RiksdagElectionInput["constituencies"][number]["partyVotes"] })),
    };
    insist(input.constituencies.length === 29 && new Set(input.constituencies.map(c => c.code)).size === 29, "Incomplete official geography");
    for (const c of input.constituencies) insist(c.validVotes > 0 && (c.validVotes - SIMULATOR_PARTY_IDS.reduce((s, p) => s + c.partyVotes[p], 0)) / c.validVotes < .12, "Unsupported other parties");
    insist(result.national.parties.filter(p => !PARTY_CODE_TO_ID[p.code]).every(p => p.seats === 0), "Unsupported elected party");
    const seats = calculateRiksdagSeats(input);
    insist(seats.tieBreaks.length === 0 && seats.parties.every(p => {
      const official = result.national.parties.find(r => PARTY_CODE_TO_ID[r.code] === p.partyId);
      return official?.seats === p.totalSeats && official.fixedSeats === p.fixedSeats && official.adjustmentSeats === p.adjustmentSeats;
    }), "Scenario must reproduce every official mandate");
    return input;
  } catch { return null; }
}

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
