import { createHash, verify, X509Certificate } from "node:crypto";
import type { Readable } from "node:stream";
import JSZip from "jszip";
import type { CountingStage, FeedMode, LiveResult } from "./types";
import { insist } from "./validation";

import { CERTIFICATE_SHA256, LIVE_ADAPTER_VERSION } from "./constants";
export { CERTIFICATE_SHA256 } from "./constants";
export const INDEX_URLS = { production: "https://resultat.val.se/resultatfiler/val2026/index.md5", rehearsal: "https://resultat.val.se/resultatfiler/genrep2026/index.md5" } as const;
export function digest(bytes: Uint8Array | string, algorithm = "sha256"): string { return createHash(algorithm).update(bytes).digest("hex"); }

export type AreaEntry = { url: string; md5: string; electionType: "RD" | "RF" | "KF"; code: string; stage: CountingStage };

/** Exact, bounded election-area filenames; overarching RF/KF summaries are not elections. */
export function areaIndexEntries(index: string): AreaEntry[] {
  if (/^d41d8cd98f00b204e9800998ecf8427e[ \t]+-$/.test(index.trim())) return [];
  const entries: AreaEntry[] = [];
  for (const line of index.trim().split(/\r?\n/).filter(Boolean)) {
    const item = line.match(/^([a-f0-9]{32})\s+\*?(\.\/[A-Za-z0-9_./-]+\.zip)$/i);
    insist(item && !item[2].includes(".."), "Malformed or unsafe official index entry");
    const match = item[2].match(/^\.\/([ps])\/(rd|rf|kf)\/Val_(?:2026|20260913)_(preliminar|slutlig)_(\d{2}|\d{4})_(RD|RF|KF)\.zip$/);
    if (!match) continue;
    insist(match[2].toUpperCase() === match[5] && (match[1] === "p" ? "preliminar" : "slutlig") === match[3], "Index election identity mismatch");
    const electionType = match[5] as AreaEntry["electionType"], code = match[4];
    if (code === "00" && electionType !== "RD") continue;
    insist(electionType === "RD" ? code === "00" : electionType === "RF" ? /^\d{2}$/.test(code) : /^\d{4}$/.test(code), "Invalid election-area code");
    entries.push({ url: new URL(item[2], INDEX_URLS.production).href, md5: item[1].toLowerCase(), electionType, code, stage: match[1] === "p" ? "preliminary" : "final-count" });
  }
  insist(entries.length <= 622 && new Set(entries.map(e => `${e.stage}/${e.electionType}/${e.code}`)).size === entries.length, "Duplicate or excessive election-area archives");
  return entries;
}

export function indexEntry(index: string, mode: FeedMode, stage: CountingStage): { url: string; md5: string } | null {
  // Before publication the official production index contains md5sum's empty
  // stdin marker, not an archive path (observed 13 September 2026). Accept only
  // this exact standalone marker; phase timing and retained results are checked
  // by the collector, so an empty index cannot erase results or hide an outage.
  if (/^d41d8cd98f00b204e9800998ecf8427e[ \t]+-$/.test(index.trim())) return null;
  const phase = stage === "preliminary" ? "preliminar" : "slutlig";
  const prefix = mode === "production" ? "Val_(?:2026|20260913)" : "Genrep_2026";
  const expected = new RegExp(`^\\./${stage === "preliminary" ? "p" : "s"}/rd/${prefix}_${phase}_00_RD\\.zip$`);
  const entries = index.trim().split(/\r?\n/).filter(Boolean).map(line => {
    const match = line.match(/^([a-f0-9]{32})\s+\*?(\.\/[A-Za-z0-9_./-]+\.zip)$/i);
    insist(match && !match[2].includes(".."), "Malformed or unsafe official index entry");
    return { path: match[2], md5: match[1].toLowerCase() };
  }).filter(entry => expected.test(entry.path));
  insist(entries.length <= 1, "Ambiguous Riksdag archive in official index");
  return entries[0] ? { url: new URL(entries[0].path, INDEX_URLS[mode]).href, md5: entries[0].md5 } : null;
}

export async function download(url: string, maxBytes: number, allow404 = false): Promise<Buffer | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-store", headers: { "User-Agent": "Politicalverse-official-election-reader", "Cache-Control": "no-cache" } });
  if (response.status === 404 && allow404) return null;
  insist(response.ok, `Official data request failed: HTTP ${response.status} (${url})`);
  insist(!response.headers.get("content-length") || Number(response.headers.get("content-length")) <= maxBytes, "Official response exceeds size limit");
  const reader = response.body?.getReader(); insist(reader, "Empty official response body");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      length += next.value.length; insist(length <= maxBytes, "Official response exceeds size limit"); chunks.push(next.value);
    }
  } catch (error) { await reader.cancel(); throw error; }
  return Buffer.concat(chunks);
}

/** Index and ZIP can briefly expose different publication generations. */
export async function downloadIndexedArchive(
  initial: { url: string; md5: string },
  options: { mode: FeedMode; stage: CountingStage; fetchFile?: typeof download; pause?: () => Promise<void>; area?: { electionType: "RD" | "RF" | "KF"; code: string } },
): Promise<{ archive: Buffer; entry: { url: string; md5: string } }> {
  const fetchFile = options.fetchFile ?? download;
  const pause = options.pause ?? (() => new Promise<void>(resolve => setTimeout(resolve, 15_000)));
  let entry = initial;
  for (let attempt = 0; attempt < 3; attempt++) {
    const archive = await fetchFile(entry.url, 64 * 1024 * 1024);
    insist(archive, "Missing result archive");
    const md5 = digest(archive, "md5");
    if (md5 === entry.md5) return { archive, entry };
    const index = await fetchFile(INDEX_URLS[options.mode], 256 * 1024);
    insist(index, "Missing result index during publication retry");
    const next = options.area ? areaIndexEntries(index.toString("utf8")).find(e => e.stage === options.stage && e.electionType === options.area!.electionType && e.code === options.area!.code) : indexEntry(index.toString("utf8"), options.mode, options.stage);
    insist(next && next.url === entry.url, "Result archive disappeared during publication retry");
    // The downloaded archive may already be the generation now in the index.
    if (md5 === next.md5) return { archive, entry: next };
    entry = next;
    if (attempt < 2) await pause();
  }
  throw new Error("Archive does not match official index checksum after bounded publication retries");
}

export function verifySignedJson(raw: Buffer, signature: Buffer, certificate: Buffer, now: string): void {
  insist(digest(certificate) === CERTIFICATE_SHA256, "Signing certificate differs from reviewed Valmyndigheten key");
  const key = new X509Certificate(certificate);
  insist(Date.parse(now) >= Date.parse(key.validFrom) && Date.parse(now) <= Date.parse(key.validTo), "Signing certificate is outside its validity period");
  insist(verify("sha256", raw, key.publicKey, signature), "Invalid official result signature");
}

export async function readSignedArchive(bytes: Buffer, entry: { url: string; md5: string }, options: { mode: FeedMode; stage: CountingStage; certificate: Buffer; now: string; kind?: "mandatfordelning" | "rostfordelning" | "summering"; area?: { electionType: "RD" | "RF" | "KF"; code: string } }): Promise<{ raw: unknown; source: LiveResult["source"] }> {
  insist(digest(bytes, "md5") === entry.md5, "Archive does not match official index checksum");
  const zip = await JSZip.loadAsync(bytes);
  const phase = options.stage === "preliminary" ? "preliminar" : "slutlig";
  const prefix = options.mode === "production" ? "Val_(?:2026|20260913)" : "Genrep_2026";
  const kind = options.kind ?? "mandatfordelning";
  const area = options.area ?? { electionType: "RD", code: "00" };
  insist(/^(RD|RF|KF)$/.test(area.electionType) && /^\d{2}(?:\d{2})?$/.test(area.code), "Invalid signed-file selector");
  // Production summaries currently omit the area code; the published 2026
  // specification includes it. Accept either exact spelling, never both files.
  const suffix = kind === "summering" ? `(?:${area.code}_)?${area.electionType}` : `${area.code}_${area.electionType}`;
  const names = Object.keys(zip.files).filter(name => new RegExp(`^${prefix}_${phase}_${kind}_${suffix}\\.json$`).test(name));
  insist(names.length === 1, "Expected one selected national file in archive");
  const file = zip.file(names[0]); const signature = zip.file(names[0].replace(/\.json$/, "_sign.sha256"));
  insist(file && signature, "Missing result or detached signature");
  const stream = file.nodeStream() as Readable;
  const chunks: Buffer[] = []; let length = 0;
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      length += chunk.length;
      if (length > (kind === "rostfordelning" ? 128 : 32) * 1024 * 1024) { stream.pause(); stream.destroy(); reject(new Error("Official JSON exceeds decompressed size limit")); return; }
      chunks.push(chunk);
    });
    stream.on("end", resolve); stream.on("error", reject);
  });
  const raw = Buffer.concat(chunks);
  verifySignedJson(raw, await signature.async("nodebuffer"), options.certificate, options.now);
  return { raw: JSON.parse(raw.toString("utf8").replace(/^\uFEFF/, "")), source: { adapterVersion: LIVE_ADAPTER_VERSION, archiveUrl: entry.url, archiveMd5: entry.md5, jsonSha256: digest(raw), certificateSha256: CERTIFICATE_SHA256, signatureVerified: true } };
}
