import { createHash, verify, X509Certificate } from "node:crypto";
import type { Readable } from "node:stream";
import JSZip from "jszip";
import type { CountingStage, FeedMode, LiveResult } from "./types";
import { insist } from "./validation";

import { CERTIFICATE_SHA256, LIVE_ADAPTER_VERSION } from "./constants";
export { CERTIFICATE_SHA256 } from "./constants";
export const INDEX_URLS = { production: "https://resultat.val.se/resultatfiler/val2026/index.md5", rehearsal: "https://resultat.val.se/resultatfiler/genrep2026/index.md5" } as const;
export function digest(bytes: Uint8Array | string, algorithm = "sha256"): string { return createHash(algorithm).update(bytes).digest("hex"); }

export function indexEntry(index: string, mode: FeedMode, stage: CountingStage): { url: string; md5: string } | null {
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
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { "User-Agent": "Politicalverse-official-election-reader" } });
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

export function verifySignedJson(raw: Buffer, signature: Buffer, certificate: Buffer, now: string): void {
  insist(digest(certificate) === CERTIFICATE_SHA256, "Signing certificate differs from reviewed Valmyndigheten key");
  const key = new X509Certificate(certificate);
  insist(Date.parse(now) >= Date.parse(key.validFrom) && Date.parse(now) <= Date.parse(key.validTo), "Signing certificate is outside its validity period");
  insist(verify("sha256", raw, key.publicKey, signature), "Invalid official result signature");
}

export async function readSignedArchive(bytes: Buffer, entry: { url: string; md5: string }, options: { mode: FeedMode; stage: CountingStage; certificate: Buffer; now: string }): Promise<{ raw: unknown; source: LiveResult["source"] }> {
  insist(digest(bytes, "md5") === entry.md5, "Archive does not match official index checksum");
  const zip = await JSZip.loadAsync(bytes);
  const phase = options.stage === "preliminary" ? "preliminar" : "slutlig";
  const prefix = options.mode === "production" ? "Val_(?:2026|20260913)" : "Genrep_2026";
  const names = Object.keys(zip.files).filter(name => new RegExp(`^${prefix}_${phase}_mandatfordelning_00_RD\\.json$`).test(name));
  insist(names.length === 1, "Expected one national mandate file in archive");
  const file = zip.file(names[0]); const signature = zip.file(names[0].replace(/\.json$/, "_sign.sha256"));
  insist(file && signature, "Missing result or detached signature");
  const stream = file.nodeStream() as Readable;
  const chunks: Buffer[] = []; let length = 0;
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      length += chunk.length;
      if (length > 32 * 1024 * 1024) { stream.pause(); stream.destroy(); reject(new Error("National mandate JSON exceeds 32 MiB")); return; }
      chunks.push(chunk);
    });
    stream.on("end", resolve); stream.on("error", reject);
  });
  const raw = Buffer.concat(chunks);
  verifySignedJson(raw, await signature.async("nodebuffer"), options.certificate, options.now);
  return { raw: JSON.parse(raw.toString("utf8").replace(/^\uFEFF/, "")), source: { adapterVersion: LIVE_ADAPTER_VERSION, archiveUrl: entry.url, archiveMd5: entry.md5, jsonSha256: digest(raw), certificateSha256: CERTIFICATE_SHA256, signatureVerified: true } };
}
