import { NOWCAST_VERSION, type NowcastEnvelope } from "../nowcast/types";
import type { CountingStage, FeedMode, LiveFeed, LiveResult } from "./types";
import { normalizeEarlyVoting, EARLY_VOTING_URL } from "./early-voting";
import { assertResultAdvance, normalizeResult } from "./result-adapter";
import {
  digest,
  download,
  INDEX_URLS,
  indexEntry,
  readSignedArchive,
  downloadIndexedArchive,
} from "./official-files";
import { insist } from "./validation";
import { LIVE_ADAPTER_VERSION } from "./constants";

export function emptyFeed(mode: FeedMode, now: string): LiveFeed {
  return {
    schemaVersion: 1,
    electionDate: "2026-09-13",
    mode,
    checkedAt: now,
    resultStatus: "awaiting-results",
    stageStatus: {
      preliminary: "awaiting-results",
      "final-count": "awaiting-results",
    },
    earlyVotingStatus: "error",
    results: { preliminary: null, "final-count": null },
    earlyVoting: null,
  };
}

/** Independent phases retain their last verified snapshot if one source fails. */
export async function collectLiveData(
  previous: LiveFeed,
  options: {
    mode: FeedMode;
    now: string;
    certificate: Buffer;
    fetchFile?: typeof download;
    nowcastBaselineSha?: string;
    nowcast?: (
      archive: Buffer,
      entry: { url: string; md5: string },
      result: LiveResult,
      previous?: NowcastEnvelope,
    ) => Promise<NowcastEnvelope>;
  },
): Promise<{ feed: LiveFeed; errors: string[]; nowcastWarnings: string[] }> {
  insist(
    previous.schemaVersion === 1 &&
      previous.electionDate === "2026-09-13" &&
      previous.mode === options.mode,
    "Previous feed identity is incompatible",
  );
  const fetchFile = options.fetchFile ?? download;
  const feed: LiveFeed = structuredClone(previous);
  feed.checkedAt = options.now;
  const errors: string[] = [],
    nowcastWarnings: string[] = [];
  if (options.nowcast && (!feed.nowcast || !feed.results.preliminary))
    feed.nowcast = {
      methodVersion: NOWCAST_VERSION,
      status: "waiting",
      checkedAt: options.now,
    };
  // After final counting begins, the preliminary Wednesday count continues independently.
  const beforePollsClose =
    Date.parse(options.now) < Date.parse("2026-09-13T18:00:00Z");
  try {
    const bytes = await fetchFile(
      INDEX_URLS[options.mode],
      256 * 1024,
      options.mode === "production",
    );
    if (!bytes) {
      insist(
        beforePollsClose &&
          !feed.results.preliminary &&
          !feed.results["final-count"],
        "Production result index unavailable after counting should have begun",
      );
      feed.stageStatus = {
        preliminary: "awaiting-results",
        "final-count": "awaiting-results",
      };
    } else {
      for (const stage of ["preliminary", "final-count"] as CountingStage[]) {
        try {
          let entry = indexEntry(bytes.toString("utf8"), options.mode, stage);
          const previousResult = feed.results[stage];
          if (!entry) {
            // A readable official index can legitimately contain no results
            // after polls close. Its first publication is event-driven, not a
            // promise at 20:00. Previously published results may never vanish.
            insist(
              !previousResult,
              `Missing previously published ${stage} archive`,
            );
            feed.stageStatus[stage] = "awaiting-results";
            continue;
          }
          let officialChanged =
            previousResult?.source.archiveMd5 !== entry.md5 ||
            previousResult?.source.adapterVersion !== LIVE_ADAPTER_VERSION;
          const modelNeedsUpdate =
            stage === "preliminary" &&
            options.nowcast &&
            (feed.nowcast?.status !== "ready" ||
              feed.nowcast.methodVersion !== NOWCAST_VERSION ||
              feed.nowcast.source?.baselineSha256 !==
                options.nowcastBaselineSha);
          const modelFailed = (error: unknown) => {
            nowcastWarnings.push(
              error instanceof Error ? error.message : String(error),
            );
            feed.nowcast = {
              ...feed.nowcast,
              methodVersion: NOWCAST_VERSION,
              status: "error",
              checkedAt: options.now,
              estimate: undefined,
            };
          };
          if (officialChanged || modelNeedsUpdate) {
            try {
              const consistent = await downloadIndexedArchive(entry, {
                mode: options.mode,
                stage,
                fetchFile,
              });
              entry = consistent.entry;
              const archive = consistent.archive;
              officialChanged =
                previousResult?.source.archiveMd5 !== entry.md5 ||
                previousResult?.source.adapterVersion !== LIVE_ADAPTER_VERSION;
              const contents = await readSignedArchive(archive, entry, {
                ...options,
                stage,
              });
              const result = normalizeResult(contents.raw, {
                ...options,
                stage,
                source: contents.source,
              });
              assertResultAdvance(previousResult, result);
              feed.results[stage] = result;
              if (stage === "preliminary" && options.nowcast) {
                try {
                  feed.nowcast = await options.nowcast(
                    archive,
                    entry,
                    result,
                    feed.nowcast,
                  );
                } catch (error) {
                  modelFailed(error);
                }
              }
            } catch (error) {
              if (officialChanged) throw error;
              // The current national snapshot already verified this unchanged
              // archive. A model-only retry must not degrade official results.
              modelFailed(error);
            }
          }
          feed.stageStatus[stage] = "ok";
        } catch (error) {
          feed.stageStatus[stage] = "error";
          errors.push(
            `${stage}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  } catch (error) {
    feed.stageStatus = { preliminary: "error", "final-count": "error" };
    errors.push(error instanceof Error ? error.message : String(error));
  }
  try {
    const raw = await fetchFile(EARLY_VOTING_URL, 8 * 1024 * 1024);
    insist(raw, "Missing early-voting CSV");
    feed.earlyVoting = normalizeEarlyVoting(raw.toString("utf8"), {
      retrievedAt: options.now,
      rawSha256: digest(raw),
    });
    feed.earlyVotingStatus = "ok";
  } catch (error) {
    feed.earlyVotingStatus = "error";
    errors.push(error instanceof Error ? error.message : String(error));
  }
  feed.resultStatus = Object.values(feed.stageStatus).includes("error")
    ? "degraded"
    : Object.values(feed.results).some(Boolean)
      ? "ok"
      : "awaiting-results";
  if (options.nowcast && feed.stageStatus.preliminary === "error")
    feed.nowcast = {
      ...feed.nowcast,
      methodVersion: NOWCAST_VERSION,
      status: "error",
      checkedAt: options.now,
      estimate: undefined,
    };
  return { feed, errors, nowcastWarnings };
}
