import type { LiveFeed, LiveResult } from "./types";
import { insist, integer, list, object, string } from "./validation";
import { CERTIFICATE_SHA256, LIVE_ADAPTER_VERSION } from "./constants";
import { EARLY_VOTING_URL } from "./early-voting";

export const LIVE_FEED_URL = "https://raw.githubusercontent.com/willrydh/Into-The-Politicalverse/live-data/election-2026.json";
export const LIVE_POLL_INTERVAL_MS = 60_000;

export function validatePublicFeed(value: unknown): LiveFeed {
  const feed = object(value, "live feed");
  insist(feed.schemaVersion === 1 && feed.mode === "production" && feed.electionDate === "2026-09-13", "Not a production 2026 feed");
  insist(typeof feed.checkedAt === "string" && Number.isFinite(Date.parse(feed.checkedAt)), "Invalid feed check time");
  insist(["awaiting-results", "ok", "degraded"].includes(String(feed.resultStatus)), "Unknown feed state");
  insist(["ok", "error"].includes(String(feed.earlyVotingStatus)), "Unknown early-voting state");
  const results = object(feed.results, "results"); const status = object(feed.stageStatus, "phase status");
  for (const stage of ["preliminary", "final-count"]) {
    insist(["awaiting-results", "ok", "error"].includes(String(status[stage])), "Unknown counting-stage status");
    if (results[stage] == null) continue;
    const result = object(results[stage], "result");
    insist(result.classification === "OFFICIAL" && result.stage === stage && result.electionDate === "2026-09-13", "Rehearsal or wrong counting phase in public result");
    insist(typeof result.sourceUpdatedAt === "string" && Number.isFinite(Date.parse(result.sourceUpdatedAt)), "Invalid result source time");
    integer(result.sourceRevision, "result revision");
    const source = object(result.source, "source");
    insist(source.adapterVersion === LIVE_ADAPTER_VERSION, "Unsupported live result adapter");
    insist(source.signatureVerified === true && source.certificateSha256 === CERTIFICATE_SHA256 && /^[a-f0-9]{64}$/.test(String(source.jsonSha256)) && /^[a-f0-9]{32}$/.test(String(source.archiveMd5)), "Missing verified provenance");
    const phase = stage === "preliminary" ? "p/rd/Val_(2026|20260913)_preliminar" : "s/rd/Val_(2026|20260913)_slutlig";
    insist(new RegExp(`^https://resultat\\.val\\.se/resultatfiler/val2026/${phase}_00_RD\\.zip$`).test(String(source.archiveUrl)), "Non-production result source");
    insist(result.protocolUrl === null || /^https:\/\/resultat\.val\.se\/protokoll\/[^\s]+\.pdf$/.test(String(result.protocolUrl)), "Invalid protocol URL");
    const constituencies = list(result.constituencies, "constituencies"); insist(constituencies.length === 29, "Incomplete constituency data");
    insist(new Set(constituencies.map(c => object(c, "constituency").code)).size === 29, "Duplicate displayed constituency");
    for (const raw of [result.national, ...constituencies]) {
      const area = object(raw, "area");
      string(area.name, "area name"); string(area.code, "area code");
      const valid = integer(area.validVotes, "valid votes"), invalid = integer(area.invalidVotes, "invalid votes"), total = integer(area.totalVotes, "all votes");
      insist(valid + invalid === total, "Invalid displayed vote totals");
      insist(integer(area.countedDistricts, "counted districts") <= integer(area.totalDistricts, "total districts"), "Invalid displayed coverage");
      const eligible = integer(area.eligibleInCountedDistricts, "eligible voters in counted districts");
      insist(eligible <= integer(area.eligibleVoters, "eligible voters") && total <= eligible, "Invalid displayed turnout denominator");
      insist(eligible === 0 ? area.turnoutInCountedDistricts === null : typeof area.turnoutInCountedDistricts === "number" && Math.abs(area.turnoutInCountedDistricts - total / eligible * 100) < 0.000001, "Invalid displayed turnout");
      const parties = list(area.parties, "parties").map(p => object(p, "party"));
      insist(new Set(parties.map(p => p.code)).size === parties.length, "Duplicate displayed party");
      insist(parties.reduce((s, p) => s + integer(p.votes, "party votes"), integer(area.otherVotes, "other votes")) === valid, "Displayed party votes do not reconcile");
      for (const p of parties) {
        string(p.name, "party name"); insist(/^\d{4}$/.test(String(p.code)), "Invalid displayed party code");
        insist(valid === 0 ? p.share === null : typeof p.share === "number" && Math.abs(p.share - (p.votes as number) / valid * 100) < 0.000001, "Invalid displayed vote share");
        if (p.seats !== null) insist(integer(p.seats, "party seats") === integer(p.fixedSeats, "fixed seats") + integer(p.adjustmentSeats, "adjustment seats"), "Invalid displayed seat components");
      }
    }
  }
  if (feed.earlyVoting != null) {
    const early = object(feed.earlyVoting, "early voting");
    insist(early.classification === "OFFICIAL", "Invalid early-voting classification");
    insist(early.sourceUrl === EARLY_VOTING_URL && /^[a-f0-9]{64}$/.test(String(early.rawSha256)), "Invalid early-voting provenance");
    insist(typeof early.retrievedAt === "string" && Number.isFinite(Date.parse(early.retrievedAt)), "Invalid early-voting time");
    const votes = integer(early.receivedVotes, "early votes");
    insist(list(early.daily, "daily early votes").reduce<number>((s, d) => s + integer(object(d, "day").votes, "day votes"), 0) === votes, "Invalid daily early-voting total");
    insist(list(early.municipalities, "municipal early votes").reduce<number>((s, m) => s + integer(object(m, "municipality").votes, "municipal votes"), 0) === votes, "Invalid municipal early-voting total");
  }
  return feed as LiveFeed;
}

export function acceptPublicFeed(previous: LiveFeed, incoming: unknown): LiveFeed {
  const next = validatePublicFeed(incoming);
  insist(Date.parse(next.checkedAt) >= Date.parse(previous.checkedAt), "Public feed check time regressed");
  if (previous.earlyVoting) insist(next.earlyVoting && Date.parse(next.earlyVoting.retrievedAt) >= Date.parse(previous.earlyVoting.retrievedAt), "Public early-voting data disappeared or regressed");
  for (const stage of ["preliminary", "final-count"] as const) {
    const oldResult = previous.results[stage], newResult = next.results[stage];
    if (oldResult) insist(newResult && newResult.sourceRevision >= oldResult.sourceRevision && newResult.sourceUpdatedAt >= oldResult.sourceUpdatedAt, "Public result disappeared or regressed");
    if (oldResult && newResult && oldResult.sourceRevision === newResult.sourceRevision) insist(oldResult.source.jsonSha256 === newResult.source.jsonSha256, "Public source changed without a new revision");
  }
  return next;
}

export function feedIsDelayed(checkedAt: string, now: number): boolean {
  const countingPeriod = now >= Date.parse("2026-09-13T18:00:00Z") && now < Date.parse("2026-10-01T00:00:00Z");
  return now - Date.parse(checkedAt) > (countingPeriod ? 15 * 60_000 : 20 * 60 * 60_000);
}

export function preferredStage(feed: LiveFeed): LiveResult["stage"] {
  return (feed.results["final-count"]?.national.countedDistricts ?? 0) > 0 ? "final-count" : "preliminary";
}
