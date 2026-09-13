import { PARTY_CODE_TO_ID } from "../live/constants";
import type { LiveFeed } from "../live/types";
import {
  NOWCAST_PARTIES,
  NOWCAST_VERSION,
  type NowcastEstimate,
} from "./types";
import { insist } from "../live/validation";
/** Invalid optional model data must never hide verified official results. */
export function publicNowcast(feed: LiveFeed): NowcastEstimate | null {
  try {
    const n = feed.nowcast,
      r = feed.results.preliminary;
    if (
      feed.mode !== "production" ||
      feed.stageStatus.preliminary === "error" ||
      n?.status !== "ready" ||
      !r
    )
      return null;
    const s = n.source,
      e = n.estimate;
    insist(
      n.methodVersion === NOWCAST_VERSION &&
        e?.methodVersion === NOWCAST_VERSION &&
        e.classification === "MODEL" &&
        e.baselineYear === 2022,
      "Wrong nowcast model",
    );
    insist(
      ["insufficient", "experimental", "counted"].includes(e.status),
      "Unknown estimate state",
    );
    insist(
      s &&
        s.archiveMd5 === r.source.archiveMd5 &&
        /^[a-f0-9]{64}$/.test(s.jsonSha256) &&
        /^[a-f0-9]{64}$/.test(s.baselineSha256),
      "Mismatched model/source",
    );
    insist(
      Number.isSafeInteger(s.revision) &&
        s.revision >= 0 &&
        Number.isFinite(Date.parse(s.updatedAt)) &&
        Date.parse(s.updatedAt) <= Date.parse(n.checkedAt) + 60_000,
      "Invalid model clock",
    );
    insist(
      e.countedVotes === r.national.validVotes &&
        e.countedDistricts === r.national.countedDistricts &&
        e.totalDistricts === r.national.totalDistricts,
      "Mismatched observed counts",
    );
    for (const x of [
      e.estimatedRemainingVotes,
      e.estimatedCollectionVotes,
      e.matchedDistricts,
      e.representedConstituencies,
      e.matchedCoverage,
      e.imputedRemainingVoteShare,
    ])
      insist(Number.isFinite(x) && x >= 0, "Invalid model coverage");
    insist(
      e.estimatedCollectionVotes <= e.estimatedRemainingVotes &&
        e.matchedCoverage <= 1.000001 &&
        e.imputedRemainingVoteShare <= 1 &&
        e.matchedDistricts <= e.countedDistricts &&
        e.representedConstituencies <= 29,
      "Impossible model coverage",
    );
    if (e.status === "insufficient") {
      insist(e.rows.length === 0, "Premature model numbers");
      return e;
    }
    insist(
      e.status !== "experimental" ||
        (e.matchedDistricts >= 100 &&
          e.matchedCoverage >= 0.05 &&
          e.representedConstituencies >= 8),
      "Insufficient model support",
    );
    insist(
      e.status !== "counted" || e.estimatedRemainingVotes === 0,
      "Uncounted votes in complete estimate",
    );
    insist(
      e.rows.length === 9 && new Set(e.rows.map((p) => p.partyId)).size === 9,
      "Incomplete model parties",
    );
    const total = e.countedVotes + e.estimatedRemainingVotes;
    insist(total > 0, "Invalid model total");
    const official = Object.fromEntries(NOWCAST_PARTIES.map((p) => [p, 0]));
    official.OTHER = r.national.otherVotes;
    for (const p of r.national.parties)
      official[PARTY_CODE_TO_ID[p.code] ?? "OTHER"] += p.votes;
    for (const row of e.rows) {
      insist(
        row.countedVotes === official[row.partyId],
        "Mismatched observed party",
      );
      insist(
        NOWCAST_PARTIES.includes(row.partyId) &&
          Number.isSafeInteger(row.countedVotes) &&
          row.countedVotes >= 0 &&
          Number.isFinite(row.projectedVotes) &&
          row.projectedVotes >= row.countedVotes,
        "Invalid projected votes",
      );
      insist(
        Math.abs(row.projectedShare - (row.projectedVotes / total) * 100) <
          0.000001,
        "Invalid projected denominator",
      );
      insist(
        e.countedVotes
          ? row.countedShare !== null &&
              Math.abs(
                row.countedShare - (row.countedVotes / e.countedVotes) * 100,
              ) < 0.000001
          : row.countedShare === null,
        "Invalid counted denominator",
      );
      insist(
        row.sensitivity.length === 2 &&
          row.sensitivity.every(
            (v) => Number.isFinite(v) && v >= 0 && v <= 100,
          ) &&
          row.sensitivity[0] <= row.projectedShare &&
          row.sensitivity[1] >= row.projectedShare,
        "Invalid sensitivity span",
      );
      insist(
        row.seats === null ||
          (Number.isSafeInteger(row.seats) &&
            row.seats >= 0 &&
            row.seats <= 349),
        "Invalid model mandates",
      );
    }
    insist(
      Math.abs(e.rows.reduce((s, p) => s + p.projectedVotes, 0) - total) <
        0.00001 &&
        e.rows.reduce((s, p) => s + p.countedVotes, 0) === e.countedVotes,
      "Model totals disagree",
    );
    const seats = e.rows.filter((r) => r.seats !== null);
    insist(
      seats.length === 0 ||
        (seats.length === 8 && seats.reduce((s, r) => s + r.seats!, 0) === 349),
      "Incomplete model allocation",
    );
    return e;
  } catch {
    return null;
  }
}
