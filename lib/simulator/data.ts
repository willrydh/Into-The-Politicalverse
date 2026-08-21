import seatDataJson from "@/data/normalized/riksdag-seat-model-inputs.json";
import { getPartyResult, riksdag2022 } from "@/lib/data/elections";
import type { RiksdagSimulatorData, SimulatorPartySeats, SimulatorPartyVotes } from "./types";
import { SIMULATOR_PARTY_IDS } from "./types";

export const riksdagSimulatorData = seatDataJson as RiksdagSimulatorData;

export type SimulatorBaseline = {
  votePatternYear: 2022;
  fixedSeatYear: 2026;
  nationalValidVotes: number;
  constituencies: RiksdagSimulatorData["backtests"][number]["constituencies"];
  shares: SimulatorPartyVotes;
  officialSeats2022: SimulatorPartySeats;
  source: RiksdagSimulatorData["source"];
  rules: RiksdagSimulatorData["rules"];
};

export function getSimulatorBaseline(): SimulatorBaseline {
  const backtest2022 = riksdagSimulatorData.backtests.find((backtest) => backtest.year === 2022);
  if (!backtest2022) throw new Error("Missing 2022 simulator baseline");
  const shares = Object.fromEntries(SIMULATOR_PARTY_IDS.map((partyId) => [partyId, getPartyResult(riksdag2022.national, partyId).share])) as SimulatorPartyVotes;

  return {
    votePatternYear: 2022,
    fixedSeatYear: 2026,
    nationalValidVotes: backtest2022.nationalValidVotes,
    constituencies: backtest2022.constituencies.map((constituency) => ({
      ...constituency,
      fixedSeats: riksdagSimulatorData.scenario.fixedSeatsByConstituency[constituency.code],
    })),
    shares,
    officialSeats2022: backtest2022.expected.total,
    source: riksdagSimulatorData.source,
    rules: riksdagSimulatorData.rules,
  };
}
