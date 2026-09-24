import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { deepStrictEqual } from "node:assert";
import { digest, verifySignedJson, areaIndexEntries } from "../live/official-files";
import { normalizeResult } from "../live/result-adapter";
import { normalizeAreaResult } from "../live/area-adapter";
import { isEstablishedResult } from "../live/headline-result";
import { areaIsEstablished } from "../live/area-types";
import { insist, object, list } from "../live/validation";
import { personalCandidates, personalCountComplete, CANDIDATE_2026_METHOD } from "./import-2026";
import type { CandidateSource } from "./types";

/** Offline release gate: verify pinned signatures and reproduce personal counts. */
export function verifyCandidates2026() {
  const manifest = JSON.parse(readFileSync("data/raw/valmyndigheten-2026/candidate-source-manifest.json", "utf8"));
  const normalized = readFileSync("data/normalized/candidate-elections-2026.json.gz");
  insist(digest(normalized) === manifest.outputSha256 && manifest.methodVersion === CANDIDATE_2026_METHOD, "2026 candidate generation checksum mismatch");
  const data = JSON.parse(gunzipSync(normalized).toString()) as CandidateSource;
  insist(data.status === (data.areas.some(a => a.status === "counted") ? "counted" : "final"), "Personal history status differs from its areas");
  const certificate = readFileSync("data/raw/valmyndigheten-2026/val-sign-crt.pem"), now = new Date().toISOString();
  const metadata = readFileSync(manifest.metadata.file);
  insist(digest(metadata) === manifest.metadata.compressedSha256 && digest(gunzipSync(metadata)) === manifest.metadata.sha256, "Candidate register checksum mismatch");
  insist(digest(readFileSync("data/normalized/election-preparation-2026.json")) === manifest.geographySha256, "Candidate geography generation changed");
  const index = readFileSync("data/raw/valmyndigheten-2026/candidates/index.md5");
  insist(digest(index) === manifest.indexSha256, "Candidate index checksum mismatch");
  const entries = areaIndexEntries(index.toString());
  let observedAreas = 0;
  for (const source of manifest.sources) {
    const bytes = gunzipSync(readFileSync(source.file)), signature = readFileSync(source.signatureFile);
    insist(digest(bytes) === source.sha256 && digest(signature) === source.signatureSha256 && source.sha256 === source.source.jsonSha256, "Candidate raw source changed");
    insist(entries.some(e => e.stage === "final-count" && e.electionType === source.electionType && e.code === source.code && e.md5 === source.source.archiveMd5), "Candidate archive absent from pinned index");
    verifySignedJson(bytes, signature, certificate, now);
    const raw = JSON.parse(bytes.toString());
    const result = source.electionType === "RD" ? normalizeResult(raw, { mode: "production", stage: "final-count", now, source: source.source }) : normalizeAreaResult(raw, { electionType: source.electionType, code: source.code, stage: "final-count", now, source: source.source });
    const established = "national" in result ? isEstablishedResult(result) : areaIsEstablished(result);
    insist(source.status === (established ? "final" : "counted"), "Personal count status differs from signed source");
    const a = object(raw.valomrade, "area");
    insist(personalCountComplete(a), "Incomplete count entered personal history");
    insist(source.protocolUrl === (a.lankTillProtokoll ?? null), "Personal count protocol differs from source");
    for (const rawArea of source.electionType === "RD" ? list(a.valkretsLista, "constituencies") : [a]) {
      const area = object(rawArea, "candidate area");
      const normalized = data.areas.find(a => a.electionType === source.electionType && a.code === area.kod);
      insist(normalized, "Missing normalized candidate area");
      insist(normalized.status === source.status, "Normalized personal count lost its status");
      deepStrictEqual({ partyVotes: normalized.partyVotes, candidates: normalized.candidates }, personalCandidates(area));
      observedAreas++;
    }
  }
  insist(observedAreas === data.areas.length, "Candidate output contains unverified areas");
  return { areas: observedAreas, identities: Object.keys(data.identities).length, personalVotes: data.anchors };
}
