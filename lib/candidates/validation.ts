import { PARTY_IDS } from "../data/elections/types";
import { CANDIDATE_YEARS, ELECTION_TYPES, type CandidateResult, type RankingRow, type RankingsPayload, type PersonShard, type CandidateCatalog, type PersonalAreaPayload } from "./types";
import { voteChange, personalVoteShare } from "./math";
function assert(ok: unknown): asserts ok { if (!ok) throw new Error("Invalid candidate data"); }
function envelope(v: unknown): asserts v is { schemaVersion: number; version: string } {
  assert(v && typeof v === "object"); const d = v as { schemaVersion: number; version: string };
  assert(d.schemaVersion === 1 && typeof d.version === "string" && /^[a-f0-9]{64}$/.test(d.version));
}
function result(r: CandidateResult) {
  assert(r && CANDIDATE_YEARS.includes(r.year) && ELECTION_TYPES.includes(r.electionType) && PARTY_IDS.includes(r.partyId));
  assert(typeof r.id === "string" && /^\d+$/.test(r.id) && typeof r.partyCode === "string" && r.partyCode.length > 0 && typeof r.name === "string" && typeof r.partyName === "string" && typeof r.areaCode === "string" && typeof r.areaName === "string" && typeof r.county === "string");
  assert([r.votes, r.partyVotes, r.lists].every(n => Number.isSafeInteger(n) && n >= 0) && r.votes <= r.partyVotes);
  assert(["constituency", "municipality", "region"].includes(r.level) && (r.supersededBy === null || Number.isSafeInteger(r.supersededBy)) && (r.boundaryKey === null || typeof r.boundaryKey === "string"));
}
function ranking(r: RankingRow) {
  result(r); assert(/^p\d{4}-\d+$/.test(r.person) && typeof r.linked === "boolean");
  const c = r.comparison; assert(c && ["comparable", "no-baseline", "zero-baseline", "changed-area", "replaced-election", "multiple-parties"].includes(c.reason));
  assert([c.delta, c.percent, c.sharePoints].every(n => n === null || Number.isFinite(n)));
  if (c.previous) assert(c.previous.year === r.year - 4 && [c.previous.votes, c.previous.partyVotes].every(n => Number.isSafeInteger(n) && n >= 0) && c.previous.votes <= c.previous.partyVotes && typeof c.previous.partyCode === "string" && typeof c.previous.partyName === "string" && PARTY_IDS.includes(c.previous.partyId));
  if (c.reason === "comparable" || c.reason === "zero-baseline") {
    assert(c.previous); const expected = voteChange(r.votes, c.previous.votes);
    assert(c.delta === expected.delta && c.percent === expected.percent && (c.reason === "zero-baseline") === (c.previous.votes === 0));
    const share = personalVoteShare(r), old = personalVoteShare(c.previous);
    assert(c.sharePoints === (share === null || old === null ? null : share - old));
  } else assert(c.delta === null && c.percent === null && c.sharePoints === null);
}
export function validateRankings(v: unknown): asserts v is RankingsPayload {
  envelope(v); const d = v as RankingsPayload;
  assert(CANDIDATE_YEARS.includes(d.year) && ELECTION_TYPES.includes(d.electionType) && Array.isArray(d.rows));
  for (const r of d.rows) { ranking(r); assert(r.year === d.year && r.electionType === d.electionType); }
}
export function validatePersonalArea(v: unknown): asserts v is PersonalAreaPayload {
  validateRankings(v); const d = v as PersonalAreaPayload;
  assert(d.electionType === "RD" && /^\d{2}$/.test(d.code) && typeof d.name === "string" && d.rows.every(r => r.areaCode === d.code));
}
export function validatePersonShard(v: unknown): asserts v is PersonShard {
  envelope(v); const d = v as PersonShard; assert(d.people && typeof d.people === "object");
  for (const [id, p] of Object.entries(d.people)) {
    assert(p.id === id && /^p\d{4}-\d+$/.test(id) && typeof p.name === "string" && typeof p.linked === "boolean" && Array.isArray(p.results) && p.results.length > 0 && Array.isArray(p.sourceIds) && p.sourceIds.every(id => /^\d{4}:\d+$/.test(id)) && Array.isArray(p.aliases));
    p.results.forEach(result);
  }
}
export function validateCatalog(v: unknown): asserts v is CandidateCatalog {
  envelope(v); const d = v as CandidateCatalog;
  assert(d.publisher === "Valmyndigheten" && /^\d{4}-\d{2}-\d{2}$/.test(d.retrievedAt) && d.methodVersion === "candidate-history-1.0.0" && Array.isArray(d.years) && d.years.join() === CANDIDATE_YEARS.join());
  assert([d.people, d.linkedPeople, d.electionIdentities, d.results].every(n => Number.isSafeInteger(n) && n > 0));
  assert(d.counties?.length === 21 && d.municipalities?.length === 290 && d.constituencies?.length === 29);
  for (const area of [...d.counties, ...d.municipalities, ...d.constituencies]) assert(typeof area.code === "string" && typeof area.name === "string");
}
