import { PARTY_IDS } from "../data/elections/types";
import { CANDIDATE_METHOD, CANDIDATE_YEARS, ELECTION_TYPES, type CandidateResult, type RankingRow, type RankingsPayload, type PersonShard, type CandidateCatalog, type PersonalAreaPayload } from "./types";
import { candidatePartyId } from "./source-parties";
import { voteChange, personalVoteShare } from "./math";
import { validateBallotPositions } from "./ballots";
function assert(ok: unknown): asserts ok { if (!ok) throw new Error("Invalid candidate data"); }
function envelope(v: unknown): asserts v is { schemaVersion: number; version: string } {
  assert(v && typeof v === "object"); const d = v as { schemaVersion: number; version: string };
  assert(d.schemaVersion === 1 && typeof d.version === "string" && /^[a-f0-9]{64}$/.test(d.version));
}
function coverage(v: unknown, type: string) {
  assert(v && typeof v === "object");
  const c = v as { expected: number; published: number; final: string[]; counted?: string[] };
  assert(c.expected === ({RD:29,RF:20,KF:290} as Record<string,number>)[type]);
  assert(Number.isSafeInteger(c.published) && c.published >= 0 && c.published <= c.expected);
  assert(Array.isArray(c.final) && c.final.length <= c.published && new Set(c.final).size === c.final.length && c.final.every(code => (type === "KF" ? /^\d{4}$/ : /^\d{2}$/).test(code)));
  if (c.counted !== undefined) assert(Array.isArray(c.counted) && c.counted.length <= c.published && new Set(c.counted).size === c.counted.length && c.counted.every(code => (type === "KF" ? /^\d{4}$/ : /^\d{2}$/).test(code)) && c.final.every(code => c.counted!.includes(code)));
}
function result(r: CandidateResult) {
  assert(r && CANDIDATE_YEARS.includes(r.year) && ELECTION_TYPES.includes(r.electionType) && PARTY_IDS.includes(r.partyId) && r.partyId === candidatePartyId(r.partyCode));
  assert(r.status === undefined || r.status === "final" || (r.year === 2026 && r.status === "counted"));
  assert(typeof r.id === "string" && /^\d+$/.test(r.id) && typeof r.partyCode === "string" && r.partyCode.length > 0 && typeof r.name === "string" && typeof r.partyName === "string" && typeof r.areaCode === "string" && typeof r.areaName === "string" && typeof r.county === "string");
  assert([r.votes, r.partyVotes, r.lists].every(n => Number.isSafeInteger(n) && n >= 0) && r.votes <= r.partyVotes);
  validateBallotPositions(r.ballotPositions, r.partyCode);
  assert(r.ballotPositions.length <= r.lists);
  assert(["constituency", "municipality", "region"].includes(r.level) && (r.supersededBy === null || Number.isSafeInteger(r.supersededBy)) && (r.boundaryKey === null || typeof r.boundaryKey === "string"));
}
function ranking(r: RankingRow) {
  result(r); assert(/^p\d{4}-\d+$/.test(r.person) && typeof r.linked === "boolean");
  const c = r.comparison; assert(c && ["comparable", "no-baseline", "zero-baseline", "changed-area", "replaced-election", "multiple-parties"].includes(c.reason));
  assert([c.delta, c.percent, c.sharePoints].every(n => n === null || Number.isFinite(n)));
  if (c.previous) {
    assert(c.previous.year === r.year - 4 && [c.previous.votes, c.previous.partyVotes].every(n => Number.isSafeInteger(n) && n >= 0) && c.previous.votes <= c.previous.partyVotes && typeof c.previous.partyCode === "string" && typeof c.previous.partyName === "string" && PARTY_IDS.includes(c.previous.partyId) && c.previous.partyId === candidatePartyId(c.previous.partyCode));
    validateBallotPositions(c.previous.ballotPositions, c.previous.partyCode);
  }
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
  if (d.year === 2026) {
    coverage(d.coverage, d.electionType);
    assert(d.coverage && Array.isArray(d.coverage.completeCounties) && d.coverage.completeCounties.every(c => /^\d{2}$/.test(c)) && d.rows.every(r => (d.coverage!.counted ?? d.coverage!.final).includes(r.areaCode) && (r.status === "counted" ? !d.coverage!.final.includes(r.areaCode) : d.coverage!.final.includes(r.areaCode))));
  }
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
  assert(d.publisher === "Valmyndigheten" && /^\d{4}-\d{2}-\d{2}$/.test(d.retrievedAt) && d.methodVersion === CANDIDATE_METHOD && Array.isArray(d.years) && d.years.join() === CANDIDATE_YEARS.join());
  assert([d.people, d.linkedPeople, d.electionIdentities, d.results].every(n => Number.isSafeInteger(n) && n > 0));
  assert(d.counties?.length === 21 && d.municipalities?.length === 290 && d.constituencies?.length === 29);
  for (const area of [...d.counties, ...d.municipalities, ...d.constituencies]) assert(typeof area.code === "string" && typeof area.name === "string");
  assert(d.coverage2026);
  for (const type of ELECTION_TYPES) coverage(d.coverage2026[type], type);
}
