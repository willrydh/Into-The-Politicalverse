import { readSignedArchive } from "../live/official-files";
import type { LiveResult, FeedMode } from "../live/types";
import { insist } from "../live/validation";
import { baseline, baselineSha256 } from "./baseline";
import { normalizeDistricts } from "./district-adapter";
import { projectVotes } from "./model";
import {
  NOWCAST_PARTIES,
  NOWCAST_VERSION,
  type Votes,
  type NowcastEnvelope,
} from "./types";
import stress from "../../data/normalized/election-nowcast-stress.json";
import { calculateRiksdagSeats } from "../simulator/riksdag-rules";
import {
  SIMULATOR_PARTY_IDS,
  type SimulatorPartyVotes,
} from "../simulator/types";

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
export async function deriveNowcast(
  archive: Buffer,
  entry: { url: string; md5: string },
  result: LiveResult,
  options: { mode: FeedMode; now: string; certificate: Buffer },
  previous?: NowcastEnvelope,
): Promise<NowcastEnvelope> {
  insist(
    result.stage === "preliminary",
    "Nowcast only supports preliminary counting",
  );
  insist(
    stress.methodVersion === NOWCAST_VERSION,
    "Outdated model stress test",
  );
  const contents = await readSignedArchive(archive, entry, {
    ...options,
    stage: "preliminary",
    kind: "rostfordelning",
  });
  const districts = normalizeDistricts(
    contents.raw,
    result,
    baseline,
    options.mode,
    options.now,
  );
  if (previous?.source) {
    insist(
      districts.revision >= previous.source.revision &&
        districts.updatedAt >= previous.source.updatedAt,
      "District source regressed",
    );
    if (districts.revision === previous.source.revision)
      insist(
        contents.source.jsonSha256 === previous.source.jsonSha256,
        "District source changed without revision",
      );
  }
  const projected = projectVotes(baseline, districts.observations, stress);
  const constituencies = result.constituencies.map((c) => {
    const votes = roundedVotes(projected.constituencyVotes.get(c.code)!);
    return {
      code: c.code,
      name: c.name,
      fixedSeats: c.fixedSeats,
      validVotes: Object.values(votes).reduce((a, b) => a + b, 0),
      partyVotes: Object.fromEntries(
        SIMULATOR_PARTY_IDS.map((p) => [p, votes[p]]),
      ) as SimulatorPartyVotes,
      other: votes.OTHER,
    };
  });
  const nationalValidVotes = constituencies.reduce(
    (s, c) => s + c.validVotes,
    0,
  );
  const other = constituencies.reduce((s, c) => s + c.other, 0);
  // The existing engine represents eight named parties. Do not give them seats
  // that might belong to an unmodelled party crossing either threshold.
  if (
    projected.estimate.status !== "insufficient" &&
    other / nationalValidVotes < 0.04 &&
    constituencies.every(
      (c) => c.validVotes > 0 && c.other / c.validVotes < 0.12,
    )
  ) {
    const seats = calculateRiksdagSeats({ nationalValidVotes, constituencies });
    for (const row of projected.estimate.rows)
      row.seats =
        seats.parties.find((p) => p.partyId === row.partyId)?.totalSeats ??
        null;
  }
  if (projected.estimate.status === "insufficient")
    projected.estimate.rows = [];
  return {
    methodVersion: NOWCAST_VERSION,
    status: "ready",
    checkedAt: options.now,
    source: {
      archiveMd5: entry.md5,
      jsonSha256: contents.source.jsonSha256,
      revision: districts.revision,
      updatedAt: districts.updatedAt,
      baselineSha256,
    },
    estimate: projected.estimate,
  };
}
