import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import JSZip from "jszip";
import { areaIndexEntries, digest, download, downloadIndexedArchive, INDEX_URLS, readSignedArchive, verifySignedJson } from "../lib/live/official-files";
import { normalizeResult } from "../lib/live/result-adapter";
import { isEstablishedResult } from "../lib/live/headline-result";
import { assertAreaIdentity, normalizeAreaResult } from "../lib/live/area-adapter";
import { areaIsEstablished } from "../lib/live/area-types";
import { integer, insist, list, object, string } from "../lib/live/validation";
import { candidateArea2026, candidateIdentities2026, parseCandidateCsv, CANDIDATE_2026_METHOD, type CurrentCandidateCoverage } from "../lib/candidates/import-2026";
import type { CandidateArea, CandidateSource, ElectionIdentity } from "../lib/candidates/types";
import geography from "../data/normalized/local-election-index.json";
import preparation from "../data/normalized/election-preparation-2026.json";

const root = resolve(import.meta.dirname, ".."), now = new Date().toISOString();
const rawDir = "data/raw/valmyndigheten-2026/candidates", manifestFile = "data/raw/valmyndigheten-2026/candidate-source-manifest.json";
const output = "data/normalized/candidate-elections-2026.json.gz", csvUrl = "https://data.val.se/filer/val2026/parti/kandidaturer.csv";
type AcceptedSource = { electionType: "RD" | "RF" | "KF"; code: string; file: string; sha256: string; signatureFile: string; signatureSha256: string; source: Awaited<ReturnType<typeof readSignedArchive>>["source"]; revision: number; updatedAt: string; protocolUrl: string };
type Manifest = { schemaVersion: 1; methodVersion: string; retrievedAt: string; indexSha256: string; coverage: CurrentCandidateCoverage; sources: AcceptedSource[]; metadata: { url: string; file: string; sha256: string; compressedSha256: string }; geographySha256: string; outputSha256: string };
let previous: Manifest | null = null;
try { previous = JSON.parse(await readFile(resolve(root, manifestFile), "utf8")); }
catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
const certificate = await readFile(resolve(root, "data/raw/valmyndigheten-2026/val-sign-crt.pem"));
const index = await download(INDEX_URLS.production, 256 * 1024); insist(index, "No official index");
const entries = areaIndexEntries(index.toString("utf8")).filter(e => e.stage === "final-count");
const coverage: CurrentCandidateCoverage = { RD: { expected: 29, published: 0, final: [] }, RF: { expected: 20, published: 0, final: [] }, KF: { expected: 290, published: 0, final: [] } };
const accepted: { raw: unknown; source: AcceptedSource }[] = [], pendingFiles = new Map<string, Buffer>();
for (const old of previous?.sources ?? []) insist(entries.some(e => e.electionType === old.electionType && e.code === old.code), "Established personal-vote archive disappeared");
let cursor = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (cursor < entries.length) {
    const entry = entries[cursor++];
    insist(entry.electionType === "RD" || (entry.electionType === "KF" ? geography.municipalities.some(a => a.code === entry.code) : geography.counties.some(a => a.code === entry.code) && entry.code !== "09"), "Unknown 2026 area");
    coverage[entry.electionType].published += entry.electionType === "RD" ? 29 : 1;
    const old = previous?.sources.find(s => s.electionType === entry.electionType && s.code === entry.code);
    if (old?.source.archiveMd5 === entry.md5) {
      const raw = gunzipSync(await readFile(resolve(root, old.file))), signature = await readFile(resolve(root, old.signatureFile));
      insist(digest(raw) === old.sha256 && digest(signature) === old.signatureSha256, "Pinned candidate source changed");
      verifySignedJson(raw, signature, certificate, now); accepted.push({ raw: JSON.parse(raw.toString("utf8")), source: old }); continue;
    }
    const cachedFile = resolve(root, `data/raw/downloads/candidates-2026/${entry.electionType}-${entry.code}-${entry.md5}.zip`);
    let archive: Buffer;
    try { archive = await readFile(cachedFile); insist(digest(archive, "md5") === entry.md5, "Cached archive mismatch"); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      const fetched = await downloadIndexedArchive(entry, { mode: "production", stage: "final-count", area: entry });
      Object.assign(entry, fetched.entry); archive = fetched.archive;
      await mkdir(dirname(cachedFile), { recursive: true }); await writeFile(cachedFile, archive);
    }
    const signed = await readSignedArchive(archive, entry, { mode: "production", stage: "final-count", area: entry, now, certificate });
    const { d, sourceRevision, sourceUpdatedAt } = assertAreaIdentity(signed.raw, entry.electionType, "final-count", now);
    const a = object(d.valomrade, "area"); insist(a.kod === entry.code, "Wrong candidate area");
    const complete = integer(a.antalValdistriktRaknade, "counted districts") === integer(a.antalValdistriktSomSkaRaknas, "all districts") && typeof a.lankTillProtokoll === "string";
    if (!complete) { insist(!old, "Established personal result regressed to unfinished"); continue; }
    const established = entry.electionType === "RD" ? isEstablishedResult(normalizeResult(signed.raw, { mode: "production", stage: "final-count", now, source: signed.source })) : areaIsEstablished(normalizeAreaResult(signed.raw, { ...entry, now, source: signed.source }));
    insist(established, "Personal votes require a fully established election result");
    if (old) {
      insist(sourceRevision >= old.revision && sourceUpdatedAt >= old.updatedAt, "Candidate source revision regressed");
      if (sourceRevision === old.revision) insist(signed.source.jsonSha256 === old.sha256, "Candidate source changed without revision");
    }
    const zip = await JSZip.loadAsync(archive), names = Object.keys(zip.files).filter(n => /_mandatfordelning_/.test(n) && n.endsWith(".json"));
    insist(names.length === 1, "Ambiguous candidate archive");
    const bytes = await zip.file(names[0])!.async("nodebuffer"), signature = await zip.file(names[0].replace(/\.json$/, "_sign.sha256"))!.async("nodebuffer");
    const file = `${rawDir}/${entry.electionType}-${entry.code}.json.gz`, signatureFile = `${rawDir}/${entry.electionType}-${entry.code}.sha256`;
    pendingFiles.set(file, gzipSync(bytes, { level: 9 })); pendingFiles.set(signatureFile, signature);
    accepted.push({ raw: signed.raw, source: { electionType: entry.electionType, code: entry.code, file, sha256: digest(bytes), signatureFile, signatureSha256: digest(signature), source: signed.source, revision: sourceRevision, updatedAt: sourceUpdatedAt, protocolUrl: string(a.lankTillProtokoll, "protocol") } });
  }
}));
// A ZIP refreshed during an index race must not be published against a stale
// pinned index. Retry the entire import on a coherent source generation.
const pinnedEntries = areaIndexEntries(index.toString("utf8"));
for (const { source } of accepted) insist(pinnedEntries.some(e => e.stage === "final-count" && e.electionType === source.electionType && e.code === source.code && e.md5 === source.source.archiveMd5), "Candidate index changed during import; retry from the new index");
accepted.sort((a, b) => `${a.source.electionType}/${a.source.code}`.localeCompare(`${b.source.electionType}/${b.source.code}`));
insist(accepted.length > 0, "No established personal-vote results available; existing data unchanged");
const metadataBytes = await download(csvUrl, 64 * 1024 * 1024); insist(metadataBytes, "Candidate register unavailable");
const municipalityNames = new Map(geography.municipalities.flatMap(m => [[m.name, m.code], [m.name.replace(/ (kommun|stad)$/, ""), m.code]] as [string, string][]));
const metadata = candidateIdentities2026(parseCandidateCsv(metadataBytes.toString("utf8")), municipalityNames);
const areas: CandidateArea[] = [], identities: Record<string, ElectionIdentity> = {}, anchors: CandidateSource["anchors"] = {};
for (const { raw, source } of accepted) {
  const a = object(object(raw, "result").valomrade, "area"), type = source.electionType;
  const observations = type === "RD" ? list(a.valkretsLista, "Riksdag constituencies").map(v => object(v, "constituency")) : [a];
  for (const observation of observations) {
    const code = string(observation.kod, "area code");
    const members = type === "RD" ? [...new Set(preparation.districts.filter(d => d.constituency === code).map(d => d.municipality))].sort() : undefined;
    const county = type === "RD" ? members?.[0]?.slice(0, 2) : code.slice(0, 2);
    insist(county && (type !== "RD" || members?.length && members.every(m => m.startsWith(county))), "Unreviewed candidate geography");
    const area = candidateArea2026(observation, { electionType: type, code, name: string(type === "RD" ? observation.namnValkrets : observation.namn, "area name"), level: type === "RD" ? "constituency" : type === "RF" ? "region" : "municipality", county, parent: type === "RD" ? "00" : type === "KF" ? county : null, ...(members ? { members } : {}) });
    areas.push(area); coverage[type].final.push(code);
    const anchor = anchors[type] ??= { validVotes: 0, personalVotes: 0 };
    anchor.validVotes += integer(object(object(observation.rostfordelning, "distribution").rosterPaverkaMandat, "votes").antalRoster, "valid votes");
    for (const c of area.candidates) {
      const identity = identities[c.id] ??= structuredClone(metadata[c.id] ?? { names: [], ages: [], municipalities: [] });
      if (!identity.names.includes(c.name)) identity.names.push(c.name);
      anchor.personalVotes += c.votes;
    }
  }
}
for (const c of Object.values(coverage)) { c.final.sort(); insist(new Set(c.final).size === c.final.length && c.final.length <= c.expected && c.published <= c.expected, "Invalid personal coverage"); }
for (const identity of Object.values(identities)) identity.names.sort();
areas.sort((a, b) => `${a.electionType}/${a.code}`.localeCompare(`${b.electionType}/${b.code}`));
const data: CandidateSource = { schemaVersion: 1, year: 2026, classification: "OFFICIAL", status: "final", methodVersion: CANDIDATE_2026_METHOD, sourceFiles: accepted.map(a => a.source.file), anchors, areas, identities };
const normalized = gzipSync(Buffer.from(JSON.stringify(data)), { level: 9 }), compressedMetadata = gzipSync(metadataBytes, { level: 9 });
const manifest: Manifest = { schemaVersion: 1, methodVersion: CANDIDATE_2026_METHOD, retrievedAt: now.slice(0, 10), indexSha256: digest(index), coverage, sources: accepted.map(a => a.source), metadata: { url: csvUrl, file: `${rawDir}/kandidaturer.csv.gz`, sha256: digest(metadataBytes), compressedSha256: digest(compressedMetadata) }, geographySha256: digest(await readFile(resolve(root, "data/normalized/election-preparation-2026.json"))), outputSha256: digest(normalized) };
// An unchanged check does not create a new source generation/deployment.
if (previous && previous.outputSha256 === manifest.outputSha256 && JSON.stringify(previous.coverage) === JSON.stringify(coverage) && JSON.stringify(previous.sources) === JSON.stringify(manifest.sources)) {
  console.log("Established personal results and coverage unchanged."); process.exit(0);
}
pendingFiles.set(`${rawDir}/index.md5`, index); pendingFiles.set(manifest.metadata.file, compressedMetadata); pendingFiles.set(output, normalized); pendingFiles.set(manifestFile, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
// All network, signature, coverage and arithmetic checks precede tracked writes.
for (const [file, bytes] of pendingFiles) { const target = resolve(root, file); await mkdir(dirname(target), { recursive: true }); await writeFile(`${target}.incoming`, bytes); await rename(`${target}.incoming`, target); }
console.log(JSON.stringify({ coverage, anchors, identities: Object.keys(identities).length, output }));
